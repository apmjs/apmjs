const chai = require('chai')
const Workspace = require('../stub/workspace')
const expect = chai.expect
const registry = require('../stub/registry.js')

describe('fresh project with package.json', function () {
  this.timeout(5000)
  before(cb => registry.startServer(cb))
  after(cb => registry.stopServer(cb))

  describe('package.json without amdDependencies', function () {
    it('should install a package', function () {
      return Workspace.create({'package.json': JSON.stringify({ name: 'main' })})
        .then(ws => ws
          .run('$APM install bar')
          .then(() => ws.readJson(`amd_modules/bar/package.json`))
          .then(foo => {
            expect(foo).to.have.property('name', 'bar')
            expect(foo).to.have.property('version', '1.1.0')
          })
       )
    })

    it('should resect amdPrefix', function () {
      return Workspace.create({'package.json': '{ "name": "main", "amdPrefix": "hei/haa" }'})
        .then(ws => ws
          .run('$APM install bar')
          .then(() => ws.readJson(`hei/haa/bar/package.json`))
          .then(foo => {
            expect(foo).to.have.property('name', 'bar')
            expect(foo).to.have.property('version', '1.1.0')
          })
       )
    })

    it('should install and save a package', function () {
      return Workspace.create({'package.json': JSON.stringify({ name: 'main' })})
        .then(ws => ws
          .run('$APM install bar --save')
          .then(() => ws.readJson(`amd_modules/bar/package.json`))
          .then(foo => {
            expect(foo).to.have.property('name', 'bar')
            expect(foo).to.have.property('version', '1.1.0')
          })
          .then(() => ws.readJson(`package.json`))
          .then(pkg => {
            console.log(pkg)
            expect(pkg.amdDependencies).to.have.property('bar', '^1.1.0')
          })
       )
    })
    it('should maintain ascending key order', function () {
      return Workspace.create({
        'package.json': JSON.stringify({
          name: 'main',
          amdDependencies: { foo: '^1.0.0' }
        })
      }).then(ws => ws
        .run('$APM install bar --save')
        .then(() => ws.readJson(`package.json`))
        .then(foo => {
          var deps = JSON.stringify(foo.amdDependencies)
          expect(deps).to.equal('{"bar":"^1.1.0","foo":"^1.0.0"}')
        }))
    })
  })

  it('should install a single package', function () {
    return Workspace.create({
      'package.json': JSON.stringify({
        name: 'main',
        amdDependencies: { foo: '^1.0.0' }
      })
    }).then(ws => ws
      .run('$APM install --loglevel info')
      .then(result => {
        expect(result.stderr).to.contain('npm info ok')
        return ws.readJson(`amd_modules/foo/package.json`)
      })
      .then(foo => {
        expect(foo).to.have.property('name', 'foo')
        expect(foo).to.have.property('version', '1.0.0')
      }))
  })

  it('should install a latest satisfying version', function () {
    return Workspace.create({
      'package.json': JSON.stringify({
        name: 'main',
        amdDependencies: { bar: '~1.0.0' }
      })
    }).then(ws => ws
      .run('$APM install')
      .then(() => ws.readJson(`amd_modules/bar/package.json`))
      .then(foo => {
        expect(foo).to.have.property('name', 'bar')
        expect(foo).to.have.property('version', '1.0.1')
      }))
  })

  it('should respect to amd-lock.json', function () {
    return Workspace
    .create({
      'package.json': JSON.stringify({
        name: 'main',
        version: '2.1.0',
        amdDependencies: { bar: '~1.0.0' }
      }),
      'amd-lock.json': JSON.stringify({
        dependencies: {
          bar: {
            version: '1.0.0',
            integrity: 'sha512-hssCTy6V5o2Lpakooc5SdtaT+idGKd+6+meJBNXggzV+aFLmdMvk7N4BjKfNJSs4HaUnpFrt7f6XGAzKQ/LpwQ=='
          }
        }
      })
    })
    .then(ws => ws.run('$APM install')
      .then(() => ws.readJson(`amd_modules/bar/package.json`))
      .then(pkg => {
        expect(pkg).to.have.property('name', 'bar')
        expect(pkg).to.have.property('version', '1.0.0')
      })
    )
  })

  describe('index.json', function () {
    it('should contain package version and path', function () {
      return Workspace
      .create({
        'package.json': JSON.stringify({
          name: 'main',
          amdDependencies: { bar: '1.0.0' }
        })
      })
      .then(ws => ws
        .run('$APM install')
        .then(() => ws.readJson(`amd_modules/index.json`))
        .then(index => expect(index).to.deep.equal(
          [{
            name: 'bar',
            version: '1.0.0',
            filepath: 'bar/index.js',
            fullpath: ws.dirpath + '/amd_modules/bar/index.js'
          }]
        ))
      )
    })

    it('should resect amdPrefix', function () {
      return Workspace.create({'package.json': '{ "name": "main", "amdPrefix": "hei/haa" }'})
      .then(ws => ws
        .run('$APM install bar')
        .then(() => ws.readJson(`hei/haa/index.json`))
        .then(index => expect(index).to.deep.equal(
          [{
            name: 'bar',
            version: '1.1.0',
            filepath: 'bar/index.js',
            fullpath: ws.dirpath + '/hei/haa/bar/index.js'
          }]
        ))
      )
    })
  })

  it('should write amd-lock.json', function () {
    return Workspace
    .create({
      'package.json': JSON.stringify({
        name: 'main',
        version: '2.1.0',
        amdDependencies: { bar: '1.0.0' }
      })
    })
    .then(ws => ws.run('$APM install --loglevel=silly')
      .then(() => ws.readJson(`amd-lock.json`))
      .then(lock => expect(lock).to.deep.equal({
        name: 'main',
        version: '2.1.0',
        dependencies: {
          bar: {
            version: '1.0.0',
            integrity: 'sha512-hssCTy6V5o2Lpakooc5SdtaT+idGKd+6+meJBNXggzV+aFLmdMvk7N4BjKfNJSs4HaUnpFrt7f6XGAzKQ/LpwQ=='
          }
        }
      }))
    )
  })

  it('should install the right dependency', function () {
    return Workspace.create({
      'package.json': JSON.stringify({
        name: 'main',
        amdDependencies: { coo: '1.0.0' }
      })
    }).then(ws => ws.run('$APM install')
      .then(result => expect(result.stdout).to.equal('main\n└─┬ coo@1.0.0 (installed)\n  └── bar@1.0.0 (installed)\n'))
      .then(() => ws.readJson(`amd_modules/coo/package.json`))
      .then(foo => expect(foo).to.have.property('version', '1.0.0'))
      .then(() => ws.readJson(`amd_modules/bar/package.json`))
      .then(foo => expect(foo).to.have.property('version', '1.0.0')))
  })

  it('should give warning and install higher version when conflict', function () {
    return Workspace.create({
      'package.json': JSON.stringify({
        name: 'main',
        version: '1.0',
        amdDependencies: { coo: '1.0.0', bar: '1.0.1' }
      })
    }).then(ws => ws.run('$APM install')
      .then(result => {
        expect(result.stderr).to.contain('version conflict: upgrade bar@<=1.0.0 (required by coo@1.0.0) to match 1.0.1 (required by main@1.0)')
      })
      .then(() => ws.readJson(`amd_modules/coo/package.json`))
      .then(pkg => expect(pkg).to.have.property('version', '1.0.0'))
      .then(() => ws.readJson(`amd_modules/bar/package.json`))
      .then(pkg => expect(pkg).to.have.property('version', '1.0.1')))
  })
})
