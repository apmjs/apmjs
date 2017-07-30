const TreeNode = require('./tree-node.js')

function loadRoot (pkg) {
  var root = new TreeNode(pkg)
  return root.populateChildren()
}

module.exports = {loadRoot}
