const { assert, expect } = require("chai") // imports the assert object from chai
const { deployments, ethers, getNamedAccounts } = require("hardhat") // abstracts the deployments, ethers, and getNamedAccounts objects from hardhat/hre object
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async function () {
          // describes the test to be performed on the smart contract FundMe
          let fundMe // declares a variable called fundMe
          let deployer // declares a variable called deployer
          let mockV3Aggregator // declares a variable called mockV3Aggregator
          const sendValue = ethers.utils.parseEther("1") // declares a constant called sendValue and assigns it a value of 1ETH, equivalent to 1 x 10**18 wei
          beforeEach(async function () {
              // actions to be performed before each test, i.e., deploy FundMe contract using hardhat-deploy
              // const accounts = await ethers.getSigners() // pulls accounts from the hardhat.config.js, ethers.getSigners() returns the data contained in the networks section under the parameter accounts (if using hardhat network or localhost, this will return 20 accounts)
              // const accountZero = accounts[0] // creates a new constant called accountZero and the account at the 0th index is assigned to accountZero
              deployer = (await getNamedAccounts()).deployer // obtains the value assigned to the deployer parameter of the getNamedAccounts object and assigns it to the variable called deployer
              await deployments.fixture(["all"]) // executes all deploy scripts in deploy folder with the tag "all"
              fundMe = await ethers.getContract("FundMe", deployer) // obtains the most recent deployment of the smart contract FundMe via ethers.getContract, a hardhat-deploy ether's function, and assigns it to the variable fundMe
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              ) // obtains the most recent deployment of the samrt contract MockV3Aggregator via ethers.getContract, a hardhat-deploy ether's function, and assigns it to the variable mockV3Aggregator
          })

          describe("constructor", async function () {
              // describes the test to be performed on the constructor function
              it("sets the aggregator addresses correctly", async function () {
                  // contains code to test if the aggregator address in mockV3Aggregator == to the aggregator address in fundMe and describes what can be concluded if the smart contract passes this test
                  const response = await fundMe.getPriceFeed() // calls the getPriceFeed() function from fundMe and assigns it to a constant called response
                  assert.equal(response, mockV3Aggregator.address) // checks if response == mockV3Aggregator.address
              })
          })

          describe("fund", async function () {
              // describes the test to be performed on the fund function
              it("Fails if you do not send enough ETH", async function () {
                  // contains code to test if funding an amount lower than the minimum value throws an eror
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  ) // checks if the error "You need to spend more ETH!" is thrown when the fund() function is called with 0 ETH sent
              })

              it("Updated the amount funded data structure", async function () {
                  // contains code to test if the amount funded mapped to the msg.sender matches with the actual amount funded by the sender
                  await fundMe.fund({ value: sendValue }) // calls the fund() function and passes it the value: sendValue pair to mimick the key:value pair that is extracted from the msg object when msg.value is called in the smart contract
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  ) // obtains the amount funded mapped to the deployer address by calling the getAddressToAmountFunded() function from fundMe and assigns it to a constant variable called response
                  assert.equal(response.toString(), sendValue.toString()) // checks if the amount funded mapped to the deployer address == sendValue, need to include .toString() since JS might not be able to accurately handle very big numbers
              })

              it("Adds funder to the s_funders array ", async function () {
                  await fundMe.fund({ value: sendValue }) // calls the fund() function and passes it the value: sendValue pair to mimick the key:value pair that is extracted from the msg object when msg.value is called in the smart contract
                  const funder = await fundMe.getFunders(0) // calls the getFunders() function from fundMe and obtains the object in the 0th index of the s_funders array and assigns it to a constant called funder
                  assert.equal(funder, deployer) // checks if the object in the 0th index of the s_funders array == deployer
              })
          })

          describe("withdraw", async function () {
              // describes the test to be performed on the withdraw function
              beforeEach(async function () {
                  await fundMe.fund({ value: sendValue }) // calls the fund() function and passes it the value: sendValue pair to mimick the key:value pair that is extracted from the msg object when msg.value is called in the smart contract
              })

              it("with withdraw ETH from a single funder", async function () {
                  // contains the code to test that the deployer's ending balance after withdrawing funds from fundMe matches with the deployer's starting balance + fundMe's balance - gas fees paid to withdraw
                  // Arrange
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address) // obtains fundMe's balance before the withdraw function is called and assigns it to a constant called startingFundMeBalance
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance before the withdraw function is called and assigns it to a constant called startingDeployerBalance
                  // Act
                  const transactionResponse = await fundMe.withdraw() // calls the withdraw function and assigns it to a constant called transactionResponse
                  const transactionReceipt = await transactionResponse.wait(1) // waits for one block confirmation before assigning the transactionResponse to a constant called transactionReceipt
                  const { gasUsed, effectiveGasPrice } = transactionReceipt // this abstracts the gasUsed and effectiveGasPrice objects from the transactionReceipt variable
                  const gasCost = gasUsed.mul(effectiveGasPrice) // this multiplies the gasUsed by the effectiveGasPrice and assigns it to a constant called gasCost
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  ) // obtains fundMe's balance after the withdraw function is called and assigns it to a constant called endingFundMeBalance
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance after the withdraw function is called and assigns it to a constant called endingDeployerBalance

                  // Assert
                  assert.equal(endingFundMeBalance, 0) // checks if fundMe's balance after the withdraw function == 0
                  assert.equal(
                      endingDeployerBalance.add(gasCost).toString(),
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString()
                  ) // checks if the deployer's balance after the withdraw function (adding back the gas cost the withdraw function cost) == the deployer's starting balance + fundMe's balance that was withdrawn
              })

              it("allows us to withdraw with multiple Funders", async function () {
                  // contains the code to test if 1) the s_funders array is emptied after withdrawing, 2) amount funded mapped to each funder is also reset to 0, 3) amount withdrawn = starting balance + fundMe balance - gas fees paid to withdraw
                  // Arrange
                  const accounts = await ethers.getSigners() // pulls accounts from the hardhat.config.js, ethers.getSigners() returns the data contained in the networks section under the parameter accounts (if using hardhat network or localhost, this will return 20 accounts)
                  for (let i = 1; i < 6; i++) {
                      // creates a for loop which starts at i = 1, and ends when i < 6, increasing i by 1 each time this loops
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      ) // connects to the smart contract using the account in the ith index of the accounts array and assigns it to a constant called fundMeConnectedContract
                      await fundMe.fund({ value: sendValue }) // calls the fund function of the fundMe contract using the account in the ith index of the accounts array
                  }
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address) // obtains fundMe's balance before the withdraw function is called and assigns it to a constant called startingFundMeBalance
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance before the withdraw function is called and assigns it to a constant called startingDeployerBalance
                  // Act
                  const transactionResponse = await fundMe.withdraw() // calls the withdraw function and assigns it to a constant called transactionResponse
                  const transactionReceipt = await transactionResponse.wait(1) // waits for one block confirmation before assigning the transactionResponse to a constant called transactionReceipt
                  const { gasUsed, effectiveGasPrice } = transactionReceipt // this abstracts the gasUsed and effectiveGasPrice objects from the transactionReceipt variable
                  const gasCost = gasUsed.mul(effectiveGasPrice) // this multiplies the gasUsed by the effectiveGasPrice and assigns it to a constant called gasCost
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  ) // obtains fundMe's balance after the withdraw function is called and assigns it to a constant called endingFundMeBalance
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance after the withdraw function is called and assigns it to a constant called endingDeployerBalance
                  // Assert
                  await expect(fundMe.getFunders(0)).to.be.reverted // checks to make sure that an error is thrown when trying to call the account in the 0th index of the s_funders array
                  for (i = 1; i < 6; i++) {
                      // creates a for loop which starts at i = 1, and ends when i < 6, increasing i by 1 each time this loops
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      ) // checks if the amount funded mapped to the account in the ith index of the accounts array is equal to 0
                  }
                  assert.equal(endingFundMeBalance, 0) // checks if fundMe's balance after the withdraw function == 0
                  assert.equal(
                      endingDeployerBalance.add(gasCost).toString(),
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString()
                  ) // checks if the deployer's balance after the withdraw function (adding back the gas cost the withdraw function cost) == the deployer's starting balance + fundMe's balance that was withdrawn
              })

              it("only allows the owner to withdraw", async function () {
                  // contains the code to test if an address besides the deployer address can call the withdraw function
                  const accounts = await ethers.getSigners() // pulls accounts from the hardhat.config.js, ethers.getSigners() returns the data contained in the networks section under the parameter accounts (if using hardhat network or localhost, this will return 20 accounts)
                  const attacker = accounts[1] // pulls the account in the 1st index of the accounts array and assigns it to a constant called attacker
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  ) // connects to the fundMe smart contract using the attacker's account
                  await expect(
                      attackerConnectedContract.withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner") // checks if the custom error "FundMe__NotOwner" is thrown when the withdraw function is called by some other address that is not the deployer's address
              })

              it("cheaperWithdraw from a single funder", async function () {
                  // contains the code to test that the deployer's ending balance after withdrawing funds from fundMe matches with the deployer's starting balance + fundMe's balance - gas fees paid to withdraw
                  // Arrange
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address) // obtains fundMe's balance before the withdraw function is called and assigns it to a constant called startingFundMeBalance
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance before the withdraw function is called and assigns it to a constant called startingDeployerBalance
                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw() // calls the withdraw function and assigns it to a constant called transactionResponse
                  const transactionReceipt = await transactionResponse.wait(1) // waits for one block confirmation before assigning the transactionResponse to a constant called transactionReceipt
                  const { gasUsed, effectiveGasPrice } = transactionReceipt // this abstracts the gasUsed and effectiveGasPrice objects from the transactionReceipt variable
                  const gasCost = gasUsed.mul(effectiveGasPrice) // this multiplies the gasUsed by the effectiveGasPrice and assigns it to a constant called gasCost
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  ) // obtains fundMe's balance after the withdraw function is called and assigns it to a constant called endingFundMeBalance
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance after the withdraw function is called and assigns it to a constant called endingDeployerBalance

                  // Assert
                  assert.equal(endingFundMeBalance, 0) // checks if fundMe's balance after the withdraw function == 0
                  assert.equal(
                      endingDeployerBalance.add(gasCost).toString(),
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString()
                  ) // checks if the deployer's balance after the withdraw function (adding back the gas cost the withdraw function cost) == the deployer's starting balance + fundMe's balance that was withdrawn
              })

              it("cheaperWithdraw with multiple funders", async function () {
                  // contains the code to test if 1) the s_funders array is emptied after withdrawing, 2) amount funded mapped to each funder is also reset to 0, 3) amount withdrawn = starting balance + fundMe balance - gas fees paid to withdraw
                  // Arrange
                  const accounts = await ethers.getSigners() // pulls accounts from the hardhat.config.js, ethers.getSigners() returns the data contained in the networks section under the parameter accounts (if using hardhat network or localhost, this will return 20 accounts)
                  for (let i = 1; i < 6; i++) {
                      // creates a for loop which starts at i = 1, and ends when i < 6, increasing i by 1 each time this loops
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      ) // connects to the smart contract using the account in the ith index of the accounts array and assigns it to a constant called fundMeConnectedContract
                      await fundMe.fund({ value: sendValue }) // calls the fund function of the fundMe contract using the account in the ith index of the accounts array
                  }
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address) // obtains fundMe's balance before the withdraw function is called and assigns it to a constant called startingFundMeBalance
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance before the withdraw function is called and assigns it to a constant called startingDeployerBalance
                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw() // calls the withdraw function and assigns it to a constant called transactionResponse
                  const transactionReceipt = await transactionResponse.wait(1) // waits for one block confirmation before assigning the transactionResponse to a constant called transactionReceipt
                  const { gasUsed, effectiveGasPrice } = transactionReceipt // this abstracts the gasUsed and effectiveGasPrice objects from the transactionReceipt variable
                  const gasCost = gasUsed.mul(effectiveGasPrice) // this multiplies the gasUsed by the effectiveGasPrice and assigns it to a constant called gasCost
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  ) // obtains fundMe's balance after the withdraw function is called and assigns it to a constant called endingFundMeBalance
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer) // obtains the deployer's balance after the withdraw function is called and assigns it to a constant called endingDeployerBalance
                  // Assert
                  await expect(fundMe.getFunders(0)).to.be.reverted // checks to make sure that an error is thrown when trying to call the account in the 0th index of the s_funders array
                  for (i = 1; i < 6; i++) {
                      // creates a for loop which starts at i = 1, and ends when i < 6, increasing i by 1 each time this loops
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      ) // checks if the amount funded mapped to the account in the ith index of the accounts array is equal to 0
                  }
                  assert.equal(endingFundMeBalance, 0) // checks if fundMe's balance after the withdraw function == 0
                  assert.equal(
                      endingDeployerBalance.add(gasCost).toString(),
                      startingDeployerBalance
                          .add(startingFundMeBalance)
                          .toString()
                  ) // checks if the deployer's balance after the withdraw function (adding back the gas cost the withdraw function cost) == the deployer's starting balance + fundMe's balance that was withdrawn
              })
          })
      })
