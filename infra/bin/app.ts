#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { PlatformStack } from '../lib/platform-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // São Paulo by default — this is a Brazilian restaurant app. Override
  // with `-c awsRegion=us-east-1` (or any other region) if you'd rather
  // deploy elsewhere.
  region: (app.node.tryGetContext('awsRegion') as string) ?? process.env.CDK_DEFAULT_REGION ?? 'sa-east-1',
}

const repoUrl =
  (app.node.tryGetContext('repoUrl') as string) ?? 'https://github.com/marcioasm84/restauranteApp.git'
const blueprintId = app.node.tryGetContext('blueprintId') as string | undefined
const bundleId = app.node.tryGetContext('bundleId') as string | undefined
const sshAllowedCidr = app.node.tryGetContext('sshAllowedCidr') as string | undefined

new PlatformStack(app, 'MeuRestaurante-Platform', { env, repoUrl, blueprintId, bundleId, sshAllowedCidr })
