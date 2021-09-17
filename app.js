const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { Passport } = require('passport');

const app = express();
const port = 3000;
const data_base = 'mongodb+srv://nigerio_bezerra:nigerio_bezerra@cluster0.pdhkp.mongodb.net/biblioteca?retryWrites=true&w=majority';

mongoose.connect(data_base, { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = new mongoose.Schema({
    classe: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model('User', UserSchema);


const LivrosSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: true
    },
    autor: {
        type: String,
        required: true
    },
    editora: {
        type: String,
        required: true
    },
    ano: {
        type: String,
        required: true
    },
    quantidade: {
        type: String,
        required: true
    }

});

const Livros = mongoose.model('livros', LivrosSchema);


//Middleware
app.set('view engine', "ejs");
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: "verygoodsecret",
    resave: false,
    saveUninitialized: true
}));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Passport.js
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    //setup user model
    User.findOne({ username: user.username }, function (err, user) {
        done(err, user);
    });
});

passport.use(new localStrategy(function (username, password, done) {
    User.findOne({ username: username }, function (err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false, { message: 'Incorrect username.' });
        }
        bcrypt.compare(password, user.password, function (err, res) {
            if (err) {
                return done(err);
            }
            if (res === false) {
                return done(null, false, { message: 'Incorrect password.' });
            }
            else {
                return done(null, user);
            }
        });
    });
}));

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        res.locals.user = req.session.passport.user;
    }
    else {
        if(req.path != '/login'){
            return res.redirect('/login')
        }
    }
    return next();
}




//Routes
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.locals.user = req.session.passport.user;
    }
    const response = {
        title: 'Home',
    }
    res.render('pages/index',  response );
});

app.get('/register', isLoggedIn, (req, res) => {
    res.render('pages/register', { title: 'Register', error: false });
});

//Setup  user
app.post('/register', isLoggedIn, async (req, res) => {
    let classe       = req.body.classe;
    let user         = req.body.username;
    let pass         = req.body.password


    const exists = await User.exists({ username: user });

    if (exists) {        
        res.redirect('/login');
        return;
    }

    bcrypt.genSalt(10, function (err, salt) {
        if (err) {
            return next(err);
        }
        bcrypt.hash(pass, salt, function (err, hash) {
            if (err) {
                return next(err);
            }
            const newUser = new User({
                classe: classe,
                username: user,
                password: hash
            });

            newUser.save();

            res.redirect('/login')
        });
    });
});



app.get('/login', isLoggedIn, (req, res) => {
    const response = {
        title: 'Login',
        error: req.query.error
    }
    res.render('pages/login', response)
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login?error=true'
}))

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

//rota para listagem dos livros
app.get("/lista", isLoggedIn, (req, res) => {
    let item = Livros.find({}, (err, livro) => {
        if (err) {
            return res.status(500).send("Erro ao consultar livros!")
        }
        else {
            res.render("pages/lista", { title: "Lista" , item: livro });
        }
    });
});

//router renderiza cadastr livroslivro
app.get("/cadastro", isLoggedIn, (req, res) => {
    res.render("pages/cadastro", { title: "Cadastro" });
})


//Router guardar no banco
app.post("/cadastro", isLoggedIn, (req, res) => {
    let livro = new Livros();// criando objeto do tipo livro
    livro.titulo = req.body.titulo;
    livro.autor = req.body.autor;
    livro.editora = req.body.editora;
    livro.ano = req.body.ano;
    livro.quantidade = req.body.quantidade;

    livro.save((err) => {
        if (err) {
            return res.status(500).send("Erro ao cadastrar!")
        }
        else {
            return res.redirect("/lista")
        }
    })
})

//DELETAR
app.get("/deletar/:id",  isLoggedIn, (req, res) => {
    let chave = req.params.id;

    Livros.deleteOne({ _id: chave }, (err, result) => {
        if (err) {
            return res.status(500).send("Erro ao excluir registro")
        } else {
            res.redirect("/lista")
        }
    });

})

//EDITAR

app.get("/editar/:id",  isLoggedIn, (req, res) => {
    let chave = req.params.id;


    let itens = Livros.find({ _id: chave }, (err, valor) => {
        if (err) {
            return res.status(500).send("Erro ao consultar livro!")
        }
        else {
            const response = {
                title: 'Editar',
                item: valor
            }
            res.render("pages/editar", response );
        }
    });

})


//UPDATE

app.post("/update",  isLoggedIn, (req, res) => {

    function updateCallback(err, result) {
        if (err) {
            console.log('err')
            res.send(err)
        }
        else {
            console.log('atualizado')
            res.redirect("/lista")
        }
    }

    Livros.findByIdAndUpdate({ _id: req.body._id }, req.body, updateCallback);
})


//pesquisa

app.get("/pesquisa", isLoggedIn, (req, res) => {
    let valor = req.query.sh;//Recebe o nema da box pesquisa
    let campo = req.query.campo;
    if (campo != "all") {
        qr = `{ "${campo}": { "$regex": "${valor}", "$options": "i" } }`;
    }
    else {
        qr = `{
            "$or": [
                {
                    "titulo": {
                        "$regex": "${valor}",
                        "$options": "i"
                    }
                },
                {
                    "autor": {
                        "$regex": "${valor}",
                        "$options": "i"
                    }
                },
                {
                    "editora": {
                        "$regex": "${valor}",
                        "$options": "i"
                    }
                },
                {
                    "ano": {
                        "$regex": "${valor}",
                        "$options": "i"
                    }
                },
                {
                    "quantidade": {
                        "$regex": "${valor}",
                        "$options": "i"
                    }
                }
               
            ]
            
        }`
    }
    let qro = JSON.parse(qr);

    Livros.find(qro, (err, item) => {
        if (err) {
            return res.status(500).send(`Erro ao consultar livro!\n${err}`);
        }
        else {
            
            res.render("pages/lista", { title: "Lista" , item: item } );
            
        }
    });

});





app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});