var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
// Set the view engine to serve us ejs
app.set('view engine', 'ejs');
// Load the express-partials middleware to support partial files
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
// Load express static middleware to serve up static assets
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'shhh, it\'s a secret',
  resave: false,
  saveUninitialized: true
}));

// Set up express routes and handle incoming GET and POST requests appropriately
// All routes (expect Auth and Wildcard routes) first does a check to see if the user is logged in. Is yes, then it processes the request. Else, it redirects user to the login page

// GET home page
app.get('/', util.checkUser, function(req, res) {
  res.render('index');
});

// GET Link creation page
app.get('/create', util.checkUser, function(req, res) {
  res.render('index');
});

// GET all links page
app.get('/links', util.checkUser, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

// POST a new link
app.post('/links', util.checkUser, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Authentication routes
/************************************************************/


app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username })
    .fetch()
    .then(function(user) {
      if (!user) {
        res.redirect('/login');
      } else {
        // BASIC VERSION
        // bcrypt.compare(password, user.get('password'), function(err, match) {
        //   if (match) {
        //     util.createSession(req, res, user);
        //   } else {
        //     res.redirect('/login');
        //   }
        // });
        // ADVANCED VERSION -- see user model
        user.comparePassword(password, function(match) {
          if (match) {
            util.createSession(req, res, user);
          } else {
            res.redirect('/login');
          }
        });
      }
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy(function(){
    res.redirect('/login');
  });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username })
    .fetch()
    .then(function(user) {
      if (!user) {
        // BASIC VERSION
        // bcrypt.hash(password, null, null, function(err, hash) {
        //   Users.create({
        //     username: username,
        //     password: hash
        //   }).then(function(user) {
        //       util.createSession(req, res, user);
        //   });
        // });
        // ADVANCED VERSION
        var newUser = new User({
          username: username,
          password: password
        });
        newUser.save()
          .then(function(newUser) {
            util.createSession(req, res, newUser);
          });
      } else {
        console.log('Account already exists');
        res.redirect('/signup');
      }
    });
});

/************************************************************/
// Handles the wildcard route last - if all other routes fail
// assumes the route is a short code and handles it here.
// If the short-code doesn't exist, sends the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
