const express = require("express");
const path = require("path");
const app = express();
const port = 3000;

const indexfile = require("./config.json");
const tests = [];
for(let testfile of indexfile.files){
    tests.push(require(testfile));
}

app.engine(".html", require("ejs").__express);

app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static(path.join(__dirname, "public")));

app.set("view engine", "html");

app.get("/", (req, res) => {
    res.render("index", {tests: tests});
});

app.get("/test/:id/", (req, res) => {
    let testid = parseInt(req.params.id);
    if(isNaN(testid) || testid < 0 || testid >= tests.length){
        res.send("<h1>error</h1><script>setTimeout(function(){window.location.href = \"/\"}, 1000)</script>");
        return;
    }
    res.render("main", {test: tests[testid]});
});

app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
});