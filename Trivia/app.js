var express = require('express')  
var app = express() 
var path=require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
var serviceAccount = require("./key.json");
initializeApp({
    credential: cert(serviceAccount)
});
const db =getFirestore();
const session=require('express-session');
var passwordHash = require('password-hash');
var bodyParser=require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret : 'secret',
    resave: false,
    saveUninitialized: true,
}));
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isAuthenticated || false;
    next();
});

app.use('/public', express.static('public'));
app.set("view engine","ejs");
app.set('views',path.join(__dirname,'views'));

app.get('/', function (req, res) { 
    res.sendFile(__dirname+"/public"+"/home.html")
})
app.get('/signup', function (req, res) { 
    let pagetitle="signup"; 
    res.render('teach_signup',{title : pagetitle,message : null});  
})

app.post('/signupSubmit',function (req, res) {  
    const name=req.body.username;
    const email=req.body.email;
    const password=req.body.password;
        db.collection("UserInfo")
            .where('Email', '==', email)
            .get()
            .then((docs) => {
                if (docs.size > 0) {
                    res.render('teach_signup',{title : "signup", message : "A user already exists with the given email"});    
                } else {
                    db.collection("UserInfo").add({
                        Name:name,
                        Email:email,
                        Password:passwordHash.generate(password),
                    }).then(()=>{
                        res.redirect('/login');
                    })
                }
            });
    });
app.get('/login', function (req, res) {  
    let pagetitle="login"; 
    res.render('teach_login',{title : pagetitle, message : null});
})

app.post('/loginsubmit', function (req, res) {  
    const email=req.body.email;
    const password=req.body.password;
    db.collection("UserInfo")
    .where('Email','==',email)
    .get()
    .then((docs) => {
        let user;

        docs.forEach(doc => {
            if (passwordHash.verify(password, doc.data().Password)) {
                user = {
                    userId: doc.id,
                    name: doc.data().Name,
                };
            }
        });
        if (user) {
            req.session.isAuthenticated = true;
            req.session.user = user;
            res.redirect('/home');
        } else {
            res.render('teach_login', { title: "login", message: "Please check your login credentials!! If you don't have an account, please signup first" });
        }
    })
})
app.get('/home',function (req,res){
    if (req.session.isAuthenticated && req.session.user) {
        res.sendFile(__dirname + "/public" + "/sample.html");
    } else {
        res.redirect('/login');
    }
})

app.get('/user_quizzes',async function (req, res) {
    try {
        const userId = req.session.user.userId;
        const quizDocs = await db.collection('quizzes').where('creatorId', '==', userId).get();

        if (quizDocs.empty) {
            res.render('user_quizzes', { userQuizzes: [] });
            return;
        }
        const userQuizzes = quizDocs.docs.map(doc => ({
            quizId: doc.id,
            quizName:doc.data().quizName,
            questions: doc.data().questions,
        }));

        res.render('user_quizzes', { userQuizzes });
    } catch (error) {
        console.error('Error fetching user quizzes:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/display_stud',async function(req,res){
    try{
        const attempted=await db.collection('quizAttempts').get();
        const stud_attempted= attempted.docs.map(doc => ({
            studentID : doc.data().studentId,
            quizId : doc.data().quizId,
            score : doc.data().score
        }))
        res.render('students_attempted',{stud_attempted});
    }
    catch(err){
        res.send('Internal Server Error');
    }
})
app.get('/create_quiz',function (req,res){
    res.sendFile(__dirname+"/public"+"/create_quiz.html");
})
app.post('/submitQuestions',function(req,res){
        const quizName=req.body.quizname;
        const numQuestions = req.body.numQuestions;
        const userId = req.session.user.userId;
        const questions = [];
        for (let i = 1; i <= numQuestions; i++) {
            const questionText = req.body[`question${i}`];
            const options = [
                req.body[`q${i}_optionA`],
                req.body[`q${i}_optionB`],
                req.body[`q${i}_optionC`],
                req.body[`q${i}_optionD`],
            ];
            var answer = req.body[`answer${i}`];
          questions.push({
            question: questionText,
            options: options,
            answer: answer
          });
          
        }
        db.collection('quizzes').add({
             questions : questions,
             creatorId: userId,
             quizName : quizName
        })
        .then((doc) => {
            res.render('quiz_created', { doc });
        })
        .catch((error) => {
            console.error('Error adding document:', error);
            res.status(500).send('Internal Server Error');
        });
})

app.get('/participant' ,function(req,res){
    res.sendFile(__dirname+"/public"+"/start_quiz.html");
})
app.get('/start_quiz',async function(req,res){
    try {
        const quizId = req.query.refId;
        console.log(req.query.refId);
        const studID=req.query.studentId;
        req.session.studentId = studID;
        const quizRef = db.collection('quizzes').doc(quizId);
        const doc = await quizRef.get();
        if (doc.exists) {
          const quizData = doc.data();
          const documentId = doc.id;
          res.render('display_quiz', { questions: quizData.questions,quizId: documentId });
        } else {
          res.send('Quiz not found');
        }
      } catch (error) {
        console.error('Error fetching quiz data:', error);
        res.send('Internal Server Error');
      }
})
app.post('/submitAnswers', async function(req, res) {
    try {
        const quizId = req.body.quizId;
        const quizRef = db.collection('quizzes').doc(quizId);
        const doc = await quizRef.get();
        const studentId = req.session.studentId;
        if (doc.exists) {
            const quizData = doc.data();
            const correctAnswers = quizData.questions.map(question => question.answer);
            const participantAnswers = [];
            const correctnessArray = [];
            for (let i = 1; i <= quizData.questions.length; i++) {
                const questionKey = `answer${i}`;
                const chosenAnswer = req.body[questionKey];
                participantAnswers.push(chosenAnswer);
                const isCorrect = chosenAnswer === correctAnswers[i - 1];
                correctnessArray.push(isCorrect);
            }
            
            const score = calculateScore(participantAnswers, correctAnswers);
            await db.collection('quizAttempts').add({
                studentId : studentId ,
                quizId: quizId,
                score: score
            })
            res.render('score', { score ,correctnessArray,quizData:quizData.questions, participantAnswers, correctAnswers});
        } else {
            res.send('Quiz not found');
        }
    } catch (error) {
        console.error('Error submitting answers:', error);
        res.send('Internal Server Error');
    }
});

function calculateScore(participantAnswers, correctAnswers) {
    let score = 0;

    for (let i = 0; i < participantAnswers.length; i++) {
        if (participantAnswers[i] === correctAnswers[i]) {
            score++;
        }
    }

    return score;
}

app.get('/score', function (req, res) { 
    res.render('score',{score});
})
app.get('/correct_answers',function(res,req){
    res.render('correct_ans')
})
app.listen(8080, function () {  
console.log('app listening on port 8080!')  
})