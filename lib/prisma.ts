import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

prisma.$use(async (params, next) => {
  if (params.action === 'findUnique' || params.action === 'findFirst') {
    params.action = 'findFirst'
    params.args.where['deleted'] = false
  }
  if (
    params.action === 'findFirstOrThrow' ||
    params.action === 'findUniqueOrThrow'
  ) {
    if (params.args.where) {
      if (params.args.where.deleted == undefined) {
        params.args.where['deleted'] = false
      }
    } else {
      params.args['where'] = { deleted: false }
    }
  }
  if (params.action === 'findMany') {
    if (params.args.where) {
      if (params.args.where.deleted == undefined) {
        params.args.where['deleted'] = false
      }
    } else {
      params.args['where'] = { deleted: false }
    }
  }
  return next(params)
})

prisma.$use(async (params, next) => {
  if (params.action == 'update') {
    params.action = 'updateMany'
    params.args.where['deleted'] = false
  }
  if (params.action == 'updateMany') {
    if (params.args.where != undefined) {
      params.args.where['deleted'] = false
    } else {
      params.args['where'] = { deleted: false }
    }
  }
  return next(params)
})

prisma.$use(async (params, next) => {
  if (params.action == 'delete') {
    params.action = 'update'
    params.args['data'] = { deleted: true }
  }
  if (params.action == 'deleteMany') {
    params.action = 'updateMany'
    if (params.args.data != undefined) {
      params.args.data['deleted'] = true
    } else {
      params.args['data'] = { deleted: true }
    }
  }
  return next(params)
})

export default prisma
