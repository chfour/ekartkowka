const express = require("express");
const path = require("path");
const app = express();
const port = 3000;

app.engine(".html", require("ejs").__express);

app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static(path.join(__dirname, "public")));

app.set("view engine", "html");

app.get("/", (req, res) => {
    res.render("index", {name: "test", author: "user"});
});

app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
});