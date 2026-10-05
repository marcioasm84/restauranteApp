import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import type { Construct } from 'constructs'

/**
 * Static hosting for the Vite build — private S3 bucket, only readable
 * through CloudFront (Origin Access Control, no public bucket policy).
 * The SPA fallback (404/403 -> index.html) mirrors what nginx.conf does
 * for the local Docker setup, since CloudFront doesn't know about
 * react-router's client-side routes.
 */
export class FrontendStack extends Stack {
  readonly bucket: s3.Bucket
  readonly distribution: cloudfront.Distribution

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    this.bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
      ],
    })

    new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName })
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId })
    new CfnOutput(this, 'SiteUrl', { value: `https://${this.distribution.distributionDomainName}` })
  }
}
