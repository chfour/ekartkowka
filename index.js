const express = require("express");
const path = require("path");
const app = express();
const port = 3000;

const createError = (errorText) => `<h1>error</h1>
<span style="font-family: monospace">${errorText || "no description provided"}</span>`
const indexfile = require("./config.json");
const tests = [];
for(let testfile of indexfile.files){
    tests.push(require(testfile));
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
    res.render("main", {test: tests[testid]});
});

app.post("/test/:id/results", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.status(404).send(createError("no such test"));
        return;
    }
    let test = tests[testid];
    let answers = [];
    test.questions.forEach(_ => answers.push(null));
    for(let qs in req.body){
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

        answers[questionno] = answer;
    }
    console.debug(answers);
    res.render("results", {test: test});
})

app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
});