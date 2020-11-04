const express = require("express");
const path = require("path");
const app = express();
const port = 3000;

// load tests
const indexfile = require("./config.json");
const tests = [];
for(let testfile of indexfile.files){
    let thistest = require(testfile);
    thistest.maxPoints = 0;
    thistest.questions.forEach(q => thistest.maxPoints += q.ptsCorrect);
    tests.push(thistest);
}

// setup ejs
app.engine(".html", require("ejs").__express);

// add views and public directory
app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static(path.join(__dirname, "public")));

// setup form data parser
app.use(require("body-parser").urlencoded({extended: true}));

// set view default file extension
app.set("view engine", "html");

// index page
app.get("/", (req, res) => {
    res.render("index", {tests: tests});
});

// test index page
app.get("/test/:id/", (req, res) => {
    // check if test exists / id is valid
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }

    // show the index page of this test
    res.render("testindex", {test: tests[testid]});
});

// main test page
app.get("/test/:id/main", (req, res) => {
    // check if test exists / id is valid
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }

    // show the test
    res.render("main", {test: tests[testid]});
});

// test results page
app.post("/test/:id/results", (req, res) => {
    // check if test exists / id is valid
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }
    // parse form data
    console.debug(req.body);
    let test = tests[testid];
    let answers = [], correctCount = 0, points = 0, timedur = 0;
    let respacked = {
        time: 0,
        answers: []
    };
    test.questions.forEach(_ => {answers.push({value: null, correct: false}); respacked.answers.push(null)});
    for(let qs in req.body){
        // get time if available
        if(qs == "time"){
            let parsedtime = parseInt(req.body.time);
            if(!isNaN(parsedtime)){
                timedur = parsedtime;
                respacked.time = parsedtime;
            }
            continue;
        }

        // get quesion index
        let questionno = parseInt(qs);
        if(isNaN(questionno) || questionno < 0 || questionno >= answers.length){
            res.status(404).render("error", {errorText: `nieprawidłowy numer pytania "${qs}"`});
            return;
        }

        // get answer index
        let answer = parseInt(req.body[qs]);
        if(isNaN(answer) || answer < 0 || answer >= test.questions[questionno].answers.length){
            res.status(404).render("error", {errorText: `nieprawidłowa odpowiedź na pytanie "${questionno}": "${req.body[qs]}"`});
            return;
        }
        answers[questionno].value = answer;
    }

    // count up points and correct answers
    for(let questionno in answers){
        let answer = answers[questionno];

        answer.correct = test.questions[questionno].correct.includes(answer.value);
        respacked.answers[questionno] = answer.value;

        if(answer.correct){
            correctCount++;
            points += test.questions[questionno].ptsCorrect;
        }else{
            points += test.questions[questionno].ptsWrong;
        }
    }
    console.debug(answers);

    // show results page
    res.render("results", {
        test: test,
        answers: answers,
        correctCount: correctCount,
        points: points,
        time: timedur,
        fmttime: function(ms){return new Date(ms).toISOString().slice(11, -5)},
        resultcode: Buffer.from(JSON.stringify(respacked)).toString("base64") // make result code
    });
});

// result code viewer
app.get("/test/:id/resultsfromcode", (req, res) => {
    // check if test exists / id is valid
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }
    // get test
    let test = tests[testid];

    // get result code / check if it's a valid one
    console.debug(req.query);
    if(!req.query.hasOwnProperty("code") || !req.query.code){
        res.status(400).render("error", {errorText: `nie podano kodu odpowiedzi`});
    }

    // decode and unpack code
    // base64 decode
    let decoded = Buffer.from(req.query.code, 'base64').toString('ascii');
    console.debug("decoded:", decoded);
    let unpacked;
    try{
        // parse JSON
        unpacked = JSON.parse(decoded);
        // check if type is correct
        if(!unpacked || typeof unpacked != "object") throw TypeError("incorrect type after parsing");
        // check for 'answers' property
        if(!unpacked.hasOwnProperty("answers")) throw Error("no 'answers' property");
    }catch(e){
        res.status(400).render("error", {errorText: `kod jest błędny / ${e.name}: ${e.message}`});
        return;
    }
    console.debug(unpacked);
    
    // check if the number of answers in code is equal to the selected test's answers
    if(unpacked.answers.length != test.questions.length){
        res.status(400).render("error", {errorText: `ilość odpowiedzi w kodzie nie jest równa ilości pytań testu, być może chodziło Ci o inny test?`});
        return;
    }

    // check answers
    let correctCount = 0, points = 0, timedur = 0, answers = [];
    test.questions.forEach(_ => answers.push({value: null, correct: false}));

    // get time if available
    if(unpacked.hasOwnProperty("time") && typeof unpacked.time == "number") timedur = unpacked.time;

    // count points and correct answers
    for(let questionno in unpacked.answers){
        let answer = unpacked.answers[questionno];

        let correct = test.questions[questionno].correct.includes(answer)
        answers[questionno].value = answer;
        answers[questionno].correct = correct;

        if(correct){
            correctCount++;
            points += test.questions[questionno].ptsCorrect;
        }else{
            points += test.questions[questionno].ptsWrong;
        }
    }

    // show the same results page, but this time with answers from the code
    res.render("results", {
        test: test,
        answers: answers,
        correctCount: correctCount,
        points: points,
        time: timedur,
        fmttime: function(ms){return new Date(ms).toISOString().slice(11, -5)},
        resultcode: Buffer.from(JSON.stringify(unpacked)).toString("base64")
    });
});

// start server
app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
});