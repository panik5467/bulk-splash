const request = require("request");
const fs = require("fs");
const https = require("https");
const path = require("path");
const ProgressBar = require("progress");

  let basePath = "./out";

  const options = {
     random: true,
     apiKey: "my-unsplash-api-key",
     search: "animal",
     amount: 20,
     featured: false,
     width: 300,
     height: 300,
     orientation: "squarish",
     nameScheme: 1,
     saveCredits: false
  }
 
 console.log(options)

  const buildUrl = ({
    featured,
    order_by,
    orientation,
    search,
    width,
    height,
    amount,
    random,
    collection,
    apiKey,
  }) => {
    let base;

    if (random) {
      base = "https://api.unsplash.com/photos/random?";
    } else if (collection) {
      let collectionId = collection.split("/")[4];
      base = `https://api.unsplash.com/collections/${collectionId}/photos?`;
    }

    const clientId = "&client_id=" + apiKey;
    const f = random && featured ? "&featured" : "";
    const ob = order_by ? "&order_by="+order_by:"";
    const a = random ? (amount > 30 ? "&count=30" : `&count=${amount}`) : "";
    const p =
      !random && collection
        ? amount > 30
          ? "&per_page=30"
          : `&per_page=${amount}`
        : "";
    const o = orientation ? `&orientation=${orientation}` : "";
    const s = search && random ? `&query=${search}` : "";
    const w = width ? `&w=${width}` : "";
    const h = height ? `&h=${height}` : "";
    return `${base}${a}${p}${o}${ob}${f}${w}${h}${s}${clientId}`;
  };

  let url;

  console.log("\n🤖 Welcome to Bulksplash! (Powered by Unsplash.com)");
  // eslint-disable-next-line max-len
  console.log(
    `\n🔰 Downloading ${options.amount}${options.featured ? " featured" : ""}${
      options.search ? ' "' + options.search + '"' : ""
    } images from:`
  );

  let bar;

  let creditsAlreadyPrinted = {};
  let c = 0;
  const saveCredits = (credits, dest) => {
    credits = Object.values(credits);

    fs.writeFile(
      dest + "/bulksplash-credits.json",
      JSON.stringify(credits, null, "\t"),
      "utf8",
      (err) => {
        if (err) {
          return;
        }
        console.log(
          "🗂  A .json file with details about the photographers has been saved to " +
            dest +
            "/bulksplash-credits.json\n"
        );
      }
    );
  };

  const download = ({ imageUrl, dest, img, apiKey, width }) => {
    let dir = path.parse(dest).dir;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    let { owner } = img;

    if (!(owner.username in creditsAlreadyPrinted)) {
      console.log(`📸 ${owner.name} (${owner.link})`);
      creditsAlreadyPrinted[owner.username] = owner;
    }

    c += 1;
    if (c == bar.total) {
      console.log("\n⏳ Preparing download...\n");
    }

    const file = fs.createWriteStream(dest);

    file.on(
      "close",
      () => {
        bar.tick();
        if (bar.complete) {
          if (bar.total == options.amount) {
            console.log("\n😌 All the photos have been downloaded!\n");
          } else if (bar.total < options.amount) {
            console.log(
              "😔 There weren't enough images under the category you suggested, so we got as many as we could."
            );
          }

          if (options.saveCredits) {
            saveCredits(creditsAlreadyPrinted, dir);
          }
        }
      },
      { once: true }
    );
    if (width) {
      imageUrl += "&w=" + width;
    }
    https
      .get(imageUrl, (response) => {
        response.pipe(file);
      })
      .on("error", function (e) {
        fs.unlink(dest, () => {});
        console.log("🚨 Error while downloading", imageUrl, e.code);
      });

    // make request to Unsplash download endpoint to meet API requirements
    // we don't download from endpoint because it deosn't let us download custom sizes
    request(
      `https://api.unsplash.com/photos/${img.id}/download?client_id=${apiKey}`,
      (error, response, body) => {
        // do nothing
      }
    );
  };

  let promises = [];
  let images = [];
  let iterations = 1;
  let tAmount = options.amount - 30;

  if (tAmount > 30) {
    while (tAmount > 0) {
      iterations += 1;
      tAmount -= 30;
    }
  }

  let processImages = () => {
    return new Promise((resolve) => {
      request(url, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          body = JSON.parse(body);

          Object.values(body).forEach((v) => {
            const img =
              options.random && (options.width || options.height)
                ? v.urls.raw
                : v.urls.full;
            images.push({
              imageUrl: img,
              id: v.id,
              owner: {
                username: v.user.username,
                name: v.user.name,
                link: v.user.links.html,
              },
            });
          });

          resolve(images);
        } else {
          console.log(
            `🚨 Something went wrong, got response code ${response.statusCode} from Unsplash - ${response.statusMessage}`
          );
        }
      });
    });
  };

  let page = 1;
  for (let i = 0; i < iterations; i++) {
    url = buildUrl(options);
    if (options.random && options.amount > 30) {
      options.amount -= 30;
    } else if (!options.random && page <= iterations) {
      options.amount -= 30;
      url += "&page=" + page;
      page += 1;
    }

    promises.push(processImages());
  }

  Promise.all(promises).then((images) => {
    images = [].concat.apply([], [...new Set(images)]);

    bar = new ProgressBar("🤩 DOWNLOADING [:bar]", {
      total: images.length,
      complete: "=",
      incomplete: " ",
    });

    let imageNum = 1;
    images.map((img) => {
      download({
        imageUrl: img.imageUrl,
        dest: path.join(
          process.cwd(),
//          `${basePath}/bulksplash-${img.owner.username}-${img.id}.jpg`
          `${basePath}/pix-${imageNum}.jpg`
        ),
        img,
        apiKey: options.apiKey,
        width: options.width,
      });

      imageNum += 1;
    });
  });

//module.exports = bulksplash;
