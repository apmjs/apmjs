const findUp = require('../src/utils/fs.js').findUp
const chai = require('chai')
const expect = chai.expect
const mock = require('mock-fs')
chai.use(require('chai-as-promised'))

describe('fs', function () {
  beforeEach(() => mock({
    '/foo': {
      'package.json': '',
      'bar': {
        'coo': {
          'daa': {
            'package.json': ''
          }
        }
      }
    },
    '/bar': {
      'coo': {}
    }
  }))
  afterEach(() => mock.restore())

  describe('.findUp()', function () {
    it('should find in current directory', function () {
      return findUp('package.json', '/foo').then(file => {
        expect(file).to.equal('/foo/package.json')
      })
    })
    it('should find in parent directory', function () {
      return findUp('package.json', '/foo/bar').then(file => {
        expect(file).to.equal('/foo/package.json')
      })
    })
    it('should find in ancestor directory', function () {
      return findUp('package.json', '/foo/bar/coo').then(file => {
        expect(file).to.equal('/foo/package.json')
      })
    })
    it('should reject if root reached', function () {
      return expect(findUp('package.json', '/bar/coo'))
        .to.eventually.rejectedWith(TypeError, /ENOENT/)
    })
    it('should return null if root already reached', function () {
      return expect(findUp('package.json', '/'))
        .to.eventually.rejectedWith(TypeError, /ENOENT/)
    })
    it('should not go up once found', function () {
      return findUp('package.json', '/foo/bar/coo/daa').then(file => {
        expect(file).to.equal('/foo/bar/coo/daa/package.json')
      })
    })
  })
})
