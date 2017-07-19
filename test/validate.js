const validate = require('../src/validate.js')
const stub = require('./stub.js')
const chai = require('chai')
const expect = chai.expect

chai.use(require('chai-as-promised'))

describe('validate', function () {
  before(() => mock({
    '/laa': stub.laa,
    '/build': {}
  }))
  after(() => mock.restore())
  describe('checkDependencies', function () {
    // it.only('should return true for an independent package', function () {
    // })
    it.only('should return true for well writen package', function () {
      return extract.extractTree('/laa').then(validate.checkDependencies)
    })
  })
})
