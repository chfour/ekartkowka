const express = require("express");
const path = require("path");
const app = express();
const port = 3000;

const indexfile = require("./config.json");
const tests = [];
for(let testfile of indexfile.files){
    let thistest = require(testfile);
    thistest.maxPoints = 0;
    thistest.questions.forEach(q => thistest.maxPoints += q.ptsCorrect);
    tests.push(thistest);
}

app.engine(".html", require("ejs").__express);

app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(require("body-parser").urlencoded({extended: true}));

app.set("view engine", "html");

app.get("/", (req, res) => {
    res.render("index", {tests: tests});
});

app.get("/test/:id/", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }
    res.render("testindex", {test: tests[testid]});
});

app.get("/test/:id/main", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }
    res.render("main", {test: tests[testid]});
});

app.post("/test/:id/results", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }
    console.debug(req.body);
    let test = tests[testid];
    let answers = [], correctCount = 0, points = 0, timedur = 0;
    let respacked = {
        time: 0,
        answers: []
    };
    test.questions.forEach(_ => {answers.push({value: null, correct: false}); respacked.answers.push(null)});
    for(let qs in req.body){
        if(qs == "time"){
            let parsedtime = parseInt(req.body.time);
            if(!isNaN(parsedtime)){
                timedur = parsedtime;
                respacked.time = parsedtime;
            }
            continue;
        }
        let questionno = parseInt(qs);
        if(isNaN(questionno) || questionno < 0 || questionno >= answers.length){
            res.status(404).render("error", {errorText: `nieprawidłowy numer pytania "${qs}"`});
            return;
        }
        let answer = parseInt(req.body[qs]);
        if(isNaN(answer) || answer < 0 || answer >= test.questions[questionno].answers.length){
            res.status(404).render("error", {errorText: `nieprawidłowa odpowiedź na pytanie "${questionno}": "${req.body[qs]}"`});
            return;
        }
        answers[questionno].value = answer;
    }
    for(let questionno in answers){
        let answer = answers[questionno];

        answer.correct = test.questions[questionno].correct.includes(answer);
        respacked.answers[questionno] = answer;

        if(answer.correct){
            correctCount++;
            points += test.questions[questionno].ptsCorrect;
        }else{
            points += test.questions[questionno].ptsWrong;
        }
    }
    console.debug(answers);
    res.render("results", {
        test: test,
        answers: answers,
        correctCount: correctCount,
        points: points,
        time: timedur,
        fmttime: function(ms){return new Date(ms).toISOString().slice(11, -5)},
        resultcode: Buffer.from(JSON.stringify(respacked)).toString("base64")
    });
});

app.get("/test/:id/resultsfromcode", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).render("error", {errorText: `nie znaleziono "${testid}"`});
        return;
    }
    let test = tests[testid];

    console.debug(req.query);
    if(!req.query.hasOwnProperty("code") || !req.query.code){
        res.status(400).render("error", {errorText: `nie podano kodu odpowiedzi`});
    }

    let decoded = Buffer.from(req.query.code, 'base64').toString('ascii');
    console.debug("decoded:", decoded);
    let unpacked;
    try{
        unpacked = JSON.parse(decoded);
        if(!unpacked || typeof unpacked != "object") throw TypeError("incorrect type after parsing");
        if(!unpacked.hasOwnProperty("answers")) throw Error("no 'answers' property");
    }catch(e){
        res.status(400).render("error", {errorText: `kod jest błędny / ${e.name}: ${e.message}`});
        return;
    }
    console.debug(unpacked);
    
    if(unpacked.answers.length != test.questions.length){
        res.status(400).render("error", {errorText: `ilość odpowiedzi w kodzie nie jest równa ilości pytań testu, może chodziło Ci o inny test?`});
        return;
    }

    let correctCount = 0, points = 0, timedur = 0;

    if(unpacked.hasOwnProperty("time") && typeof unpacked == "number") timedur = unpacked.time;

    for(let questionno in unpacked.answers){
        let answer = unpacked.answers[questionno];

        answer.correct = test.questions[questionno].correct.includes(answer);
        unpacked.answers[questionno] = answer;

        if(answer.correct){
            correctCount++;
            points += test.questions[questionno].ptsCorrect;
        }else{
            points += test.questions[questionno].ptsWrong;
        }
    }

    res.render("results", {
        test: test,
        answers: unpacked.answers,
        correctCount: correctCount,
        points: points,
        time: timedur,
        fmttime: function(ms){return new Date(ms).toISOString().slice(11, -5)},
        resultcode: Buffer.from(JSON.stringify(unpacked)).toString("base64")
    });
});

app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
});