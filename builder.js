const { promisify } = require("util");

const ejs = require("ejs");
const fse = require("fs-extra");
const promGlob = promisify(require("glob"));
const path = require("path");

const pathSrc = "./src";
const pathBuild = "./build";

const something = require(`${pathSrc}/data/something.json`);
const prices = {};

async function loadPrices() {
  // Get price files
  const jsonPaths = await promGlob("**/*.json", {
    cwd: `${pathSrc}/data/prices`,
  });

  // Load prices
  for (const jsonPath of jsonPaths) {
    const pricesForLocation = require(`${pathSrc}/data/prices/${jsonPath}`);
    const jsonPathData = path.parse(jsonPath);
    const locationName = pricesForLocation.location || jsonPathData.name;
    prices[locationName] = pricesForLocation.prices;
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
