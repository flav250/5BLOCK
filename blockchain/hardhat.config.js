require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",

  networks: {
    // 🔥 Réseau local Hardhat
    hardhat: {},

    localhost: {
      url: "http://127.0.0.1:8545",
    },

    // 🌍 Sepolia (tu peux laisser commenté si tu veux)
    /*
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.API_KEY}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    */
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
