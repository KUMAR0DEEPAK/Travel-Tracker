import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

// --- Database Connection ---
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "$$POSGRES$$", // Replace with your actual password
  port: 5432,
});
db.connect();

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// --- Global Variable ---
let currentUserId = 1;

// --- Helper Function ---
async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

// --- Routes ---

// GET /
app.get("/", async (req, res) => {
  const usersResult = await db.query("SELECT * FROM users");
  const users = usersResult.rows;

  if (users.length === 0) return res.render("new.ejs");

  let currentUser = users.find((user) => user.id == currentUserId);
  if (!currentUser) {
    currentUser = users[0];
    currentUserId = currentUser.id;
  }

  const countries = await checkVisited();

  res.render("index.ejs", {
    countries,
    total: countries.length,
    users,
    color: currentUser.color,
    currentUser,
    error: null,
  });
});

// POST /add
app.post("/add", async (req, res) => {
  const input = req.body["country"];

  const usersResult = await db.query("SELECT * FROM users");
  const users = usersResult.rows;
  let currentUser = users.find((user) => user.id == currentUserId);
  if (!currentUser) {
    currentUser = users[0];
    currentUserId = currentUser.id;
  }

  const countries = await checkVisited();

  if (!input || input.trim() === "") {
    return res.render("index.ejs", {
      countries,
      total: countries.length,
      users,
      color: currentUser.color,
      currentUser,
      error: "Country name cannot be empty.",
    });
  }

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error("Country not found.");
    }

    const countryCode = result.rows[0].country_code;

    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [countryCode, currentUserId]
    );

    res.redirect("/");
  } catch (err) {
    let errorMessage = "Country not found. Please try again.";
    if (err.message.includes("duplicate key")) {
      errorMessage = "You have already added this country.";
    }

    res.render("index.ejs", {
      countries,
      total: countries.length,
      users,
      color: currentUser.color,
      currentUser,
      error: errorMessage,
    });
  }
});

// POST /user
app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

// POST /new
app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const newUser = result.rows[0];
  currentUserId = newUser.id;

  res.redirect("/");
});


// --- Server Listener ---
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
