import { Stack, type StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type { Construct } from 'constructs'

/**
 * Shared VPC for every other stack. A single NAT gateway keeps the monthly
 * bill down (~half of a 2-NAT setup) — fine for a single-restaurant app;
 * bump `natGateways` if you need AZ-level resilience for outbound traffic.
 */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    })
  }
}
