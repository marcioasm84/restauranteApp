#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { NetworkStack } from '../lib/network-stack'
import { DataStack } from '../lib/data-stack'
import { BackendStack } from '../lib/backend-stack'
import { FrontendStack } from '../lib/frontend-stack'
import { CiCdStack } from '../lib/cicd-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // São Paulo by default — this is a Brazilian restaurant app. Override
  // with `-c awsRegion=us-east-1` (or any other region) if you'd rather
  // deploy elsewhere.
  region: (app.node.tryGetContext('awsRegion') as string) ?? process.env.CDK_DEFAULT_REGION ?? 'sa-east-1',
}

// "owner/repo" on GitHub — used only to scope the OIDC trust policy so
// that *only* workflow runs from this repo can assume the deploy role.
const githubRepo = (app.node.tryGetContext('githubRepo') as string) ?? 'marcioasm84/restauranteApp'

const network = new NetworkStack(app, 'DiferenteDmais-Network', { env })

const data = new DataStack(app, 'DiferenteDmais-Data', { env, vpc: network.vpc })
data.addDependency(network)

const backend = new BackendStack(app, 'DiferenteDmais-Backend', { env, vpc: network.vpc, data })
backend.addDependency(data)

const frontend = new FrontendStack(app, 'DiferenteDmais-Frontend', { env })

const cicd = new CiCdStack(app, 'DiferenteDmais-CiCd', {
  env,
  githubRepo,
  repository: backend.repository,
  cluster: backend.service.cluster,
  service: backend.service,
  siteBucket: frontend.bucket,
  distribution: frontend.distribution,
})
cicd.addDependency(backend)
cicd.addDependency(frontend)
