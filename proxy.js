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

// Функція для отримання шляху до файлу
const getCachePath = (statusCode) => path.join(cache, `${statusCode}.jpg`);

// Функція для завантаження зображення з http.cat
const fetchImageFromHttpCat = async (statusCode) => {
  try {
    const response = await superagent.get(`https://http.cat/${statusCode}`).buffer(true);
    return response.body; // Це має бути буфер
  } catch (error) {
    console.error("Error fetching image from http.cat:", error);
    return null; // Якщо сталася помилка, повертаємо null
  }
};

const server = http.createServer(async (req, res) => {
  const statusCode = req.url.substring(1);

  // PUT: записати файл у кеш
  if (req.method === "PUT") {
    const cachePath = getCachePath(statusCode);
    const fileStream = fs.createWriteStream(cachePath);
    req.pipe(fileStream);
    fileStream.on("finish", () => {
      res.statusCode = 201;
      res.end("Image saved successfully.");
    });
  }

  // GET: отримати файл із кешу
  else if (req.method === "GET") {
    const cachePath = getCachePath(statusCode);

    // Перевірка наявності файлу в кеші
    fs.readFile(cachePath, async (err, data) => {
      if (err) {
        // Якщо файлу немає в кеші, завантажуємо з http.cat
        const image = await fetchImageFromHttpCat(statusCode);

        if (image) {
          // Перевірка, чи є отриманий об'єкт буфером
          if (Buffer.isBuffer(image)) {
            // Якщо картинка є буфером, зберігаємо її в кеш
            fs.writeFile(cachePath, image, (err) => {
              if (err) {
                res.statusCode = 500;
                res.end("Failed to save image.");
              } else {
                res.statusCode = 200;
                res.setHeader("Content-Type", "image/jpeg");
                res.end(image);
              }
            });
          } else {
            res.statusCode = 500;
            res.end("Invalid image format.");
          }
        } else {
          // Якщо картинку не вдалося завантажити
          res.statusCode = 404;
          res.end("Image not found.");
        }
      } else {
        // Якщо картинка є в кеші
        res.statusCode = 200;
        res.setHeader("Content-Type", "image/jpeg");
        res.end(data);
      }
    });
  }

  // DELETE: видалити файл із кешу
  else if (req.method === "DELETE") {
    const cachePath = getCachePath(statusCode);
    fs.unlink(cachePath, (err) => {
      if (err) {
        res.statusCode = 404;
        res.end("Image not found.");
      } else {
        res.statusCode = 200;
        res.end("Image deleted successfully.");
      }
    });
  }

  // Інші методи - 405 Method Not Allowed
  else {
    res.statusCode = 405;
    res.end("Method Not Allowed");
  }
});

// Запуск сервера
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});