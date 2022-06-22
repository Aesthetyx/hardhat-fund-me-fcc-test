// Normal format of deploy script:
// 1. import
// 2. declare main function
// 3. call main function

// format 1 of deploy script using hardhat-deploy: (easier to understand format but i assume less widely used)
// 1. import
// 2. declare functions
// 3. export the correct deploy function as the default function for hardhat-deploy to look for
// e.g.,
// imports
// async function deployFunc(hre) {
//     ...
// }
// module.exports.default = deployFunc

// format 2 of deploy script using hardhat-deploy: (harder to understand at the start but i assume more widely used)
// 1. import
// 2. declare anonymous async function and export it as the default function for hardhat-deploy to look for in the same section of code
// e.g.,
// imports
// module.export = async (hre) => {
//    const { getNamedAccounts, deployments } = hre
//     ...
// }
//
// which is also the same as
//
// imports
// module.export = async ({ getNamedAccounts, deployments }) = {
//    ...
// }

const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { network } = require("hardhat")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // if chainId is A use address B
    // if chainId is X use address Y
    let ethUsdPriceFeedAddress
    if (developmentChains.includes(network.name)) {
        const ethUsdAggregator = await deployments.get("MockV3Aggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address
    } else {
        ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    }

    // to perform mocking, if the contract does not exist, we deploy a minimal version of it for our local testing (via a separate deploy script)

    // when deploying on localhost or hardhat network, we need to use a mock
    const args = [ethUsdPriceFeedAddress]
    const fundMe = await deploy("FundMe", {
        contract: "FundMe",
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        await verify(fundMe.address, args)
    }
    log("-----------------------------------------------------------------")
}
module.exports.tags = ["all", "fundme"]
