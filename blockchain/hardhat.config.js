require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

module.exports = {
  defaultNetwork: "sepolia",
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.API_KEY}`,
      accounts: {
        mnemonic: process.env.PASS_PHRASE,
      },
    },
  },
  solidity: "0.8.20",
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
