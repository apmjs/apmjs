function PackageEntry (pkg) {
  this.pkg = pkg
}

PackageEntry.init = function () {
  PackageEntry.entries = {}
}

PackageEntry.check = function () {
  _.forOwn(PackageEntry.entries, entry => entry.check())
}

PackageEntry.findOrCreate = function (pkg) {
  var key = pkg.name
  return PackageEntry.entries[key] || (PackageEntry.entries[key] = new PackageEntry(pkg))
}

PackageEntry.prototype.require = function (who) {
  this.requiredBy = who
  this.required = true
}

PackageEntry.prototype.define = function (pkg) {
  this.pkg = pkg
  this.defined = true
}

PackageEntry.prototype.check = function () {
  if (this.required && !this.defined) {
    throw new error.PackageNotFound(this.pkg.name, this.requiredBy)
  }
  if (!this.required && this.defined) {
    console.log(this.pkg)
    throw new error.UnusedPackage(this.pkg)
  }
}

module.exports = PackageEntry
