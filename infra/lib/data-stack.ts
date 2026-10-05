import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import type { Construct } from 'constructs'

const DB_NAME = 'mesaviva'
const DB_PORT = 5432
const REDIS_PORT = 6379

interface DataStackProps extends StackProps {
  vpc: ec2.Vpc
}

/**
 * PostgreSQL (RDS) + Redis (ElastiCache) + the app's own staff-login
 * secrets. Both datastores live in isolated subnets (no route to the
 * internet at all); the ingress rules letting the ECS tasks reach them are
 * declared in BackendStack (see the comment there for why).
 *
 * Each staff password gets its own generated Secrets Manager entry —
 * random on first deploy, read (or rotated) individually from the console
 * or CLI afterwards. See AWS_DEPLOYMENT.md.
 */
export class DataStack extends Stack {
  readonly dbInstance: rds.DatabaseInstance
  readonly dbSecurityGroup: ec2.SecurityGroup
  readonly redisCluster: elasticache.CfnCacheCluster
  readonly redisSecurityGroup: ec2.SecurityGroup
  readonly jwtSecret: secretsmanager.Secret
  readonly adminPasswordSecret: secretsmanager.Secret
  readonly waiterPasswordSecret: secretsmanager.Secret
  readonly kitchenPasswordSecret: secretsmanager.Secret

  static readonly dbName = DB_NAME
  static readonly dbPort = DB_PORT
  static readonly redisPort = REDIS_PORT

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props)
    const { vpc } = props

    // --- PostgreSQL ------------------------------------------------------
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Diferente D+ — RDS PostgreSQL',
      allowAllOutbound: false,
    })

    this.dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      databaseName: DB_NAME,
      port: DB_PORT,
      credentials: rds.Credentials.fromGeneratedSecret('mesaviva_app'),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      multiAz: false,
      backupRetention: Duration.days(7),
      deletionProtection: false,
      // SNAPSHOT keeps a final backup on `cdk destroy` instead of silently
      // deleting restaurant data — see the teardown section of the guide.
      removalPolicy: RemovalPolicy.SNAPSHOT,
    })

    // --- Redis -------------------------------------------------------------
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Diferente D+ — ElastiCache Redis',
      allowAllOutbound: false,
    })

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Diferente D+ — Redis subnet group',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    })

    this.redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      engine: 'redis',
      cacheNodeType: 'cache.t4g.micro',
      numCacheNodes: 1,
      port: REDIS_PORT,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [this.redisSecurityGroup.securityGroupId],
    })

    // --- Staff login secrets -----------------------------------------------
    this.jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      description: 'Diferente D+ — JWT signing key',
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    })
    this.adminPasswordSecret = new secretsmanager.Secret(this, 'AdminPassword', {
      description: 'Diferente D+ — admin role password',
      generateSecretString: { excludePunctuation: true, passwordLength: 20 },
    })
    this.waiterPasswordSecret = new secretsmanager.Secret(this, 'WaiterPassword', {
      description: 'Diferente D+ — garçom role password',
      generateSecretString: { excludePunctuation: true, passwordLength: 20 },
    })
    this.kitchenPasswordSecret = new secretsmanager.Secret(this, 'KitchenPassword', {
      description: 'Diferente D+ — cozinha role password',
      generateSecretString: { excludePunctuation: true, passwordLength: 20 },
    })
  }

  get redisEndpoint(): string {
    return this.redisCluster.attrRedisEndpointAddress
  }

  get dbHostname(): string {
    return this.dbInstance.instanceEndpoint.hostname
  }
}
