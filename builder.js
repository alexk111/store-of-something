const { promisify } = require("util");

const csv = require("csv-parser");
const ejs = require("ejs");
const fse = require("fs-extra");
const promGlob = promisify(require("glob"));
const path = require("path");

const pathSrc = "./src";
const pathBuild = "./build";

const something = require(`${pathSrc}/data/something.json`);
const prices = {};

async function loadPricesFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    fse
      .createReadStream(filePath)
      .pipe(csv({}))
      .on("data", (data) => {
        const strDate = data["date"]; // YYYY-MM-DD
        const arrDate = strDate.split("-");
        if (arrDate.length !== 3) {
          throw new Error(
            `Invalid Date "${strDate}". Dates should be in "YYYY-MM-DD" format.`
          );
        }
        if (arrDate[0] * 1 >= 2010) {
          const strCategory = data["name"];
          const strPrice = data["dollar_price"];
          prices[strCategory] = prices[strCategory] || {};
          prices[strCategory][strDate] = (strPrice * 1).toFixed(2) * 1;
        }
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}
async function loadPrices() {
  // Get price files
  const csvPaths = await promGlob("**/*.csv", {
    cwd: `${pathSrc}/data`,
  });

  // Load prices
  for (const csvPath of csvPaths) {
    await loadPricesFromCSV(`${pathSrc}/data/${csvPath}`);
  }
}

async function build() {
  console.info("Building...");

  // Load prices
  await loadPrices();

  // Clear build dir
  await fse.emptyDir(pathBuild);

  // Copy static assets
  fse.copy(`${pathSrc}/assets`, `${pathBuild}/assets`);
  console.info("Copied assets");

  // Get templates
  const tplPaths = await promGlob("**/*.ejs", { cwd: `${pathSrc}/templates` });

  // Generate pages from templates
  tplPaths.forEach(async (tplPath) => {
    const tplPathData = path.parse(tplPath);
    const destPath = path.join(pathBuild, tplPathData.dir);

    await fse.mkdirs(destPath);
    const pageHtml = await ejs.renderFile(
      `${pathSrc}/templates/${tplPath}`,
      {
        something,
        prices,
      },
      { async: true }
    );

    const htmlFilePath = `${pathBuild}/${tplPathData.name}.html`;
    fse.writeFile(htmlFilePath, pageHtml).then(() => {
      console.info(`Built ${htmlFilePath}`);
    });
  });
}

build();
