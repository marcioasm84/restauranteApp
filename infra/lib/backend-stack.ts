import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import type { Construct } from 'constructs'
import type { DataStack } from './data-stack'

interface BackendStackProps extends StackProps {
  vpc: ec2.Vpc
  data: DataStack
}

/**
 * The API + WebSocket backend: one ECR repo, one Fargate service behind an
 * ALB. `desiredCount: 2` is deliberate — it's the smallest setup that
 * actually exercises the Redis pub/sub fan-out built in Fase 4 (a message
 * from a client connected to task A has to reach a client connected to
 * task B). Drop to 1 if you want to shave the second task's cost and don't
 * need that redundancy yet.
 */
export class BackendStack extends Stack {
  readonly service: ecs.FargateService
  readonly loadBalancer: elbv2.ApplicationLoadBalancer
  readonly distribution: cloudfront.Distribution
  readonly repository: ecr.Repository
  readonly ecsSecurityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props)
    const { vpc, data } = props

    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: 'diferente-dmais-backend',
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ description: 'Keep last 10 images', maxImageCount: 10 }],
    })

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc, containerInsights: true })

    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Diferente D+ — ECS backend tasks',
    })
    // Tasks only need to reach the datastores + the internet (via NAT, for
    // pulling the image and calling out if ever needed) — no inbound rule
    // on this SG itself. The rules below are declared as standalone
    // resources *in this stack* (rather than via data.dbSecurityGroup's own
    // addIngressRule, which would record the rule in DataStack and need a
    // reference back to this stack's SG — a cyclic stack dependency, since
    // this stack already depends on DataStack for the DB/Redis endpoints).
    new ec2.CfnSecurityGroupIngress(this, 'EcsToRds', {
      groupId: data.dbSecurityGroup.securityGroupId,
      sourceSecurityGroupId: this.ecsSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'ECS backend -> RDS',
    })
    new ec2.CfnSecurityGroupIngress(this, 'EcsToRedis', {
      groupId: data.redisSecurityGroup.securityGroupId,
      sourceSecurityGroupId: this.ecsSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      description: 'ECS backend -> Redis',
    })

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: '/diferente-dmais/backend',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: 'diferente-dmais-backend',
      cpu: 256,
      memoryLimitMiB: 512,
    })

    const dbSecret = data.dbInstance.secret!
    taskDefinition.addContainer('backend', {
      image: ecs.ContainerImage.fromEcrRepository(this.repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'backend', logGroup }),
      portMappings: [{ containerPort: 4000 }],
      environment: {
        PORT: '4000',
        DB_HOST: data.dbHostname,
        DB_PORT: String(data.dbInstance.instanceEndpoint.port),
        DB_NAME: 'mesaviva',
        REDIS_URL: `redis://${data.redisEndpoint}:6379`,
        ADMIN_USERNAME: 'admin',
        WAITER_USERNAME: 'garcom',
        KITCHEN_USERNAME: 'cozinha',
      },
      secrets: {
        DB_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(data.jwtSecret),
        ADMIN_PASSWORD: ecs.Secret.fromSecretsManager(data.adminPasswordSecret),
        WAITER_PASSWORD: ecs.Secret.fromSecretsManager(data.waiterPasswordSecret),
        KITCHEN_PASSWORD: ecs.Secret.fromSecretsManager(data.kitchenPasswordSecret),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'node -e "fetch(\'http://localhost:4000/api/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"'],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(30),
      },
    })

    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      securityGroups: [this.ecsSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      // Keep the full desired count up during a rolling deploy instead of
      // dropping to 50% — briefly runs up to double the tasks instead.
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    })

    const scaling = this.service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 4 })
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 65,
      scaleInCooldown: Duration.minutes(5),
      scaleOutCooldown: Duration.minutes(1),
    })

    // --- ALB -----------------------------------------------------------
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    })

    const listener = this.loadBalancer.addListener('HttpListener', { port: 80, open: true })
    listener.addTargets('BackendTargets', {
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.service],
      healthCheck: {
        path: '/api/health',
        interval: Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      // The WebSocket connection is long-lived and stateful per task; once
      // ALB picks a target it should keep a given client pinned there for
      // the life of the connection.
      stickinessCookieDuration: Duration.hours(1),
    })

    // --- CloudFront in front of the ALB ---------------------------------
    // The frontend is served over HTTPS (CloudFront gives it that for
    // free), so the API/WS it calls has to be HTTPS too, or browsers block
    // it as mixed content. Rather than requiring a purchased domain + ACM
    // certificate just to get a working deployment, put the ALB behind its
    // own CloudFront distribution: it gets a valid *.cloudfront.net HTTPS
    // endpoint immediately, no domain needed (this leg — CloudFront to the
    // ALB — stays plain HTTP, which is normal for this pattern and fine
    // inside AWS's network). Swap this for the ALB's own HTTPS listener +
    // ACM cert once you set up a custom domain (see AWS_DEPLOYMENT.md
    // section 11); either way the app only ever talks to one HTTPS URL.
    this.distribution = new cloudfront.Distribution(this, 'BackendDistribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(this.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
    })

    new CfnOutput(this, 'BackendUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Backend public URL (use as VITE_API_URL at the frontend build step)',
    })
    new CfnOutput(this, 'BackendWsUrl', {
      value: `wss://${this.distribution.distributionDomainName}/ws`,
      description: 'Backend WebSocket URL (use as VITE_WS_URL at the frontend build step)',
    })
    new CfnOutput(this, 'EcrRepositoryUri', { value: this.repository.repositoryUri })
    new CfnOutput(this, 'EcsClusterName', { value: cluster.clusterName })
    new CfnOutput(this, 'EcsServiceName', { value: this.service.serviceName })
  }
}
