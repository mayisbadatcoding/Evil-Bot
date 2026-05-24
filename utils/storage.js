const fs = require("fs");
const path = require("path");

const pointsPath = path.join(__dirname, "..", "data", "points.json");

function readPoints() {
    if (!fs.existsSync(pointsPath)) {
        fs.writeFileSync(pointsPath, JSON.stringify({}, null, 4));
    }

    const data = fs.readFileSync(pointsPath, "utf8");
    return JSON.parse(data || "{}");
}

function savePoints(points) {
    fs.writeFileSync(pointsPath, JSON.stringify(points, null, 4));
}

module.exports = {
    readPoints,
    savePoints
};