var fs = require('co-fs');
var path = require('path');
var views = require('co-views');
var origFs = require('fs');
var koaRouter = require('koa-router');
var bodyParser = require('koa-bodyparser');
var formParser = require('co-busboy');

var Tools = require('./tools');
var FilePath = require('./fileMap').filePath;
var FileManager = require('./fileManager');

var router = new koaRouter();
var render = views(path.join(__dirname, './views'), {map: {html: 'ejs'}});

router.get('/', function *() {
  this.redirect('files');
});

router.get('/files', function *() {
  if (!this.session || !this.session.user) {
    this.redirect('login');
  }
  this.body = yield render('files');
});

// login
router.get('/login', function *() {
  this.body = yield render('login');
});

// api login user
router.post('/login', bodyParser(), function *() {
  var user = this.request.body.username;
  var pass = this.request.body.password;
  if (user === "admin" && pass === 'admin') {
    this.session.user = user;
    this.status = 200;
    this.body = 'Login Succeed!';
  }
  else {
    this.status = 400;
    this.body = 'Login Failed!';
  }
});
// api logout user
router.get('/logout', function *() {
  this.session.user = null;
  this.status = 200;
  this.body = 'Logout Succeed!';
});

router.get('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
  var p = this.request.fPath;
  var stats = yield fs.stat(p);
  if (stats.isDirectory()) {
    this.body = yield * FileManager.list(p);
  }
  else {
    //this.body = yield fs.createReadStream(p);
    this.body = origFs.createReadStream(p);
  }
});

router.del('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
  var p = this.request.fPath;
  yield * FileManager.remove(p);
  this.body = 'Delete Succeed!';
});

router.put('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, bodyParser(), function* () {
  var type = this.query.type;
  var p = this.request.fPath;
  if (!type) {
    this.status = 400;
    this.body = 'Lack Arg Type'
  }
  else if (type === 'MOVE') {
    var src = this.request.body.src;
    if (!src || ! (src instanceof Array)) return this.status = 400;
    var src = src.map(function (relPath) {
      return FilePath(relPath, true);
    });
    yield * FileManager.move(src, p);
    this.body = 'Move Succeed!';
  }
  else if (type === 'RENAME') {
    var target = this.request.body.target;
    if (!target) return this.status = 400;
    yield * FileManager.rename(p, FilePath(target, true));
    this.body = 'Rename Succeed!';
  }
  else {
    this.status = 400;
    this.body = 'Arg Type Error!';
  }
});

router.post('/api/(.*)', Tools.loadRealPath, Tools.checkPathNotExists, bodyParser(), function *() {
  var type = this.query.type;
  var p = this.request.fPath;
  if (!type) {
    this.status = 400;
    this.body = 'Lack Arg Type!';
  }
  else if (type === 'CREATE_FOLDER') {
    yield * FileManager.mkdirs(p);
    this.body = 'Create Folder Succeed!';
  }
  else if (type === 'UPLOAD_FILE') {
    var formData = yield formParser(this.req);
    if (formData.fieldname === 'upload'){
      var writeStream = origFs.createWriteStream(p);
      formData.pipe(writeStream);
      this.body = 'Upload File Succeed!';
    }
    else {
      this.status = 400;
      this.body = 'Lack Upload File!';
    }
  }
  else if (type === 'CREATE_ARCHIVE') {
    var src = this.request.body.src;
    if (!src) return this.status = 400;
    src = src.map(function(file) {
      return FilePath(file, true);
    })
    var archive = p;
    yield * FileManager.archive(src, archive, C.data.root, !!this.request.body.embedDirs);
    this.body = 'Create Archive Succeed!';
  }
  else {
    this.status = 400;
    this.body = 'Arg Type Error!';
  }
});

module.exports = router.middleware();
