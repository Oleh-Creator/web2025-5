const http = require("http");
const fs = require("fs");
const path = require("path");
const superagent = require("superagent");
const { program } = require("commander");

program
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port")
  .requiredOption("-c, --cache <cache>", "Cache directory")
  .parse(process.argv);

const { host, port, cache } = program.opts();

// Створюємо директорію cache, якщо вона не існує
if (!fs.existsSync(cache)) {
  fs.mkdirSync(cache, { recursive: true });
  console.log(`Created cache directory: ${cache}`);
}

// Функція для отримання шляху до файлу
const getCachePath = (statusCode) => path.join(cache, `${statusCode}.jpg`);

// Функція для завантаження зображення з http.cat
const fetchImageFromHttpCat = async (statusCode) => {
  try {
    console.log(`Fetching image from https://http.cat/${statusCode}`);
    const response = await superagent.get(`https://http.cat/${statusCode}`).buffer(true);
    return response.body;
  } catch (error) {
    console.error(`Error fetching image from http.cat for status ${statusCode}:`, error.message);
    return null;
  }
};

const server = http.createServer(async (req, res) => {
  console.log(`Received ${req.method} request for ${req.url}`);
  const statusCode = req.url.substring(1);

  if (req.method === "PUT") {
    const cachePath = getCachePath(statusCode);
    const fileStream = fs.createWriteStream(cachePath);
    req.pipe(fileStream);
    fileStream.on("finish", () => {
      console.log(`Saved image to ${cachePath}`);
      res.statusCode = 201;
      res.end("Image saved successfully.");
    });
    fileStream.on("error", (err) => {
      console.error(`Error saving image to ${cachePath}:`, err.message);
      res.statusCode = 500;
      res.end("Failed to save image.");
    });
  } else if (req.method === "GET") {
    const cachePath = getCachePath(statusCode);
    fs.readFile(cachePath, async (err, data) => {
      if (err) {
        console.log(`Image not found in cache: ${cachePath}, fetching from http.cat`);
        const image = await fetchImageFromHttpCat(statusCode);
        if (image && Buffer.isBuffer(image)) {
          fs.writeFile(cachePath, image, (err) => {
            if (err) {
              console.error(`Error saving image to ${cachePath}:`, err.message);
              res.statusCode = 500;
              res.end("Failed to save image.");
            } else {
              console.log(`Saved image to ${cachePath} from http.cat`);
              res.statusCode = 200;
              res.setHeader("Content-Type", "image/jpeg");
              res.end(image);
            }
          });
        } else {
          res.statusCode = 404;
          res.end("Image not found.");
        }
      } else {
        console.log(`Serving image from cache: ${cachePath}`);
        res.statusCode = 200;
        res.setHeader("Content-Type", "image/jpeg");
        res.end(data);
      }
    });
  } else if (req.method === "DELETE") {
    const cachePath = getCachePath(statusCode);
    fs.unlink(cachePath, (err) => {
      if (err) {
        console.log(`Image not found for deletion: ${cachePath}`);
        res.statusCode = 404;
        res.end("Image not found.");
      } else {
        console.log(`Deleted image: ${cachePath}`);
        res.statusCode = 200;
        res.end("Image deleted successfully.");
      }
    });
  } else {
    console.log(`Method not allowed: ${req.method}`);
    res.statusCode = 405;
    res.end("Method Not Allowed");
  }
});

server.on("error", (err) => {
  console.error("Server error:", err.message);
});

// Явно прив’язуємо до IPv4
server.listen(port, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${port}`);
});