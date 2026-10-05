import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import type * as ecr from 'aws-cdk-lib/aws-ecr'
import type * as ecs from 'aws-cdk-lib/aws-ecs'
import type * as s3 from 'aws-cdk-lib/aws-s3'
import type * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import type { Construct } from 'constructs'

interface CiCdStackProps extends StackProps {
  /** e.g. "marcioasm84/restauranteApp" */
  githubRepo: string
  repository: ecr.Repository
  cluster: ecs.ICluster
  service: ecs.FargateService
  siteBucket: s3.Bucket
  distribution: cloudfront.Distribution
}

/**
 * Lets GitHub Actions deploy without ever holding a long-lived AWS access
 * key: workflow runs request a short-lived token from AWS STS, proven by a
 * signed OIDC token GitHub itself issues for that specific repo. The role
 * below only grants what the app-deploy workflow actually does (push an
 * image, roll the ECS service, sync the frontend bucket, bust the
 * CloudFront cache) — provisioning infrastructure changes (`cdk deploy`)
 * stays a manual, human-run step from your own machine. See
 * AWS_DEPLOYMENT.md for why that split is deliberate.
 */
export class CiCdStack extends Stack {
  constructor(scope: Construct, id: string, props: CiCdStackProps) {
    super(scope, id, props)
    const { githubRepo, repository, cluster, service, siteBucket, distribution } = props

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    })

    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: 'diferente-dmais-github-deploy',
      description: 'Assumed by GitHub Actions to deploy app changes (not infrastructure)',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        // Any branch/PR/environment in this one repo. Narrow to
        // `repo:${githubRepo}:ref:refs/heads/main` if you want to restrict
        // deploys to a single branch.
        StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:*` },
      }),
    })

    repository.grantPullPush(deployRole)
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    )

    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:DescribeServices', 'ecs:UpdateService'],
        resources: ['*'],
        conditions: { ArnEquals: { 'ecs:cluster': cluster.clusterArn } },
      }),
    )
    // Registering/describing task definitions isn't scopable by cluster —
    // it's still limited to "define a new revision", never to touching a
    // *running* task in some other cluster.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RegisterTaskDefinition', 'ecs:DescribeTaskDefinition'],
        resources: ['*'],
      }),
    )
    const taskDef = service.taskDefinition
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [taskDef.executionRole!.roleArn, taskDef.taskRole.roleArn],
      }),
    )

    siteBucket.grantReadWrite(deployRole)
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
      }),
    )

    new CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set as the AWS_DEPLOY_ROLE_ARN secret/variable in the GitHub repo',
    })
  }
}
