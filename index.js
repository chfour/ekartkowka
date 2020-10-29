const express = require("express");
const path = require("path");
const app = express();
const port = 3000;

const createError = (errorText) => `<h1>error</h1>
<span style="font-family: monospace">${errorText || "no description provided"}</span>`
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
        res.status(404).send(createError("no such test"));
        return;
    }
    res.render("testindex", {test: tests[testid]});
});

app.get("/test/:id/main", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).send(createError("no such test"));
        return;
    }
    res.render("main", {test: tests[testid]});
});

app.post("/test/:id/results", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).send(createError("no such test"));
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
            res.status(404).send(createError(`invalid question id: ${qs}`));
            return;
        }
        let answer = parseInt(req.body[qs]);
        if(isNaN(answer) || answer < 0 || answer >= test.questions[questionno].answers.length){
            res.status(404).send(createError(`invalid answer for question ${questionno}: ${req.body[qs]}`));
            return;
        }

        let correct = test.questions[questionno].correct.includes(answer);
        answers[questionno] = {
            value: answer,
            correct: correct
        };
        respacked.answers[questionno] = answer;
        if(correct){
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

app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
});