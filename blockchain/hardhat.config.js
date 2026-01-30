// hardhat.config.js - AVEC AUTO-MINING

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      mining: {
        auto: true,
        interval: 1000
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      mining: {
        auto: true,
        interval: 1000
      }
    },
    sepolia: {
      url: process.env.API_KEY 
        ? `https://sepolia.infura.io/v3/${process.env.API_KEY}`
        : "",
      accounts: process.env.PASS_PHRASE
        ? { mnemonic: process.env.PASS_PHRASE }
        : [],
      chainId: 11155111,
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
