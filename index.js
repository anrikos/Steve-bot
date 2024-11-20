const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const fs = require('fs'); //Here we use regular fs
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });
const SITE =
    'https://www.cisco.com/c/en/us/products/routers/product-listing.html';

const currentDate = new Date().toISOString().replace(/:/g, '-');
const txtPath = `Routers_${currentDate}.txt`;

let isParsing = false; // Flag for bot operation

// /start command handler

bot.onText(/\/start/, async (msg) => {
    if (!isParsing) {
        isParsing = true; // Устанавливаем флаг выполнения

        await bot.sendMessage(msg.chat.id, "Let's start!");
        await handleStart(msg); // Вызов функции обработки

        isParsing = false; // Сбрасываем флаг после завершения
    } else {
        await bot.sendMessage(msg.chat.id, 'Already processing, please wait.');
    }
});

// /stop command handler
bot.onText(/\/stop/, (msg) => {
    isParsing = false; // Сбрасываем флаг парсинга
    bot.sendMessage(msg.chat.id, "Let's stop!"); // Уведомление о прекращении
});

// Function for command processing
async function handleStart(msg) {
    const userChatId = msg.chat.id; // User ID for reply
    isParsing = true; // Set the parsing flag to true
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(SITE, {
            waitUntil: 'networkidle2',
            timeout: 180000,
        });
        // Checking if parsing is still active
        if (!isParsing) {
            await browser.close();
            return;
        }

        const data = await page.evaluate(() => {
            const parentDiv = document.getElementById(
                'res-listing-product-portfolio'
            );
            if (parentDiv) {
                const elements =
                    parentDiv.getElementsByClassName('list-section-cat');

                return Array.from(elements).map((element) => element.innerText);
            }
        });
        const dataLinks = await page.evaluate(() => {
            const parentDivLinks = document.getElementById(
                'res-listing-product-portfolio'
            );
            if (parentDivLinks) {
                const elementsLinks =
                    parentDivLinks.getElementsByClassName('list-section-cat');

                // Converting a collection of elements into an array
                return Array.from(elementsLinks).flatMap((elementsLinks) => {
                    // Selecting all li inside the element
                    const listItems = elementsLinks.getElementsByTagName('li');

                    // Convert the li collection into an array and get links from each <li>
                    return Array.from(listItems).flatMap((li) => {
                        const linkElements = li.getElementsByTagName('a'); // We get all the links inside the current li
                        return Array.from(linkElements).map((a) => a.href); // Returning the href array
                    });
                });
            }
            return []; // Return an empty array if parentDiv is not found
        });
        const columnText = await data.join('\n');
        // Checking if parsing is still active
        if (!isParsing) {
            await browser.close();
            return;
        }

        await fs.promises.writeFile(txtPath, columnText);

        await bot.sendDocument(userChatId, fs.createReadStream(txtPath)); // Send to user
        console.log('TXT sent to user in personal chat!');

        // Delete the file after sending (optional)
        await fs.promises.unlink(txtPath);

        for (const url of dataLinks) {
            try {
                await page.goto(url, {
                    waitUntil: 'networkidle2',
                    timeout: 180000,
                });
                // We are looking for a hyperlink with the text “data sheet”

                const dataSheetLink = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    return links
                        .filter(
                            (link) =>
                                link.textContent.includes('data sheet') ||
                                link.textContent.includes('data_sheet')
                        )
                        .map((link) => link.href); // We get the href array of all matching links
                });
                if (dataSheetLink) {
                    console.log(`Found data sheet link: ${dataSheetLink}`);

                    // Follow every link found
                    for (const link of dataSheetLink) {
                        console.log('Follow the link:', link);

                        try {
                            await page.goto(link, {
                                waitUntil: 'networkidle2',
                                timeout: 180000,
                            });
                            await page.evaluate(() => {
                                const bannerIds = [
                                    'cocoa-proactice-chat',
                                    'onetrust-banner-sdk',
                                ];
                                bannerIds.forEach((id) => {
                                    const banner = document.getElementById(id);
                                    if (banner) {
                                        banner.style.display = 'none';
                                    }
                                });
                            });

                            // Extracting the page title from the URL (last segment)
                            const urlSegments = link.split('/');
                            const penultimateSegment =
                                urlSegments[urlSegments.length - 2];
                            const lastSegment =
                                urlSegments[urlSegments.length - 1];
                            const fileName =
                                `${penultimateSegment}-${lastSegment}.pdf`.replace(
                                    /[<>:"/\\|?*]/g,
                                    '-'
                                );
                            // Checking if parsing is still active
                            if (!isParsing) {
                                await browser.close();
                                return;
                            }

                            // Save the page in PDF format
                            await page.pdf({ path: fileName, format: 'A4' });

                            await bot.sendDocument(
                                userChatId,
                                fs.createReadStream(fileName)
                            ); // Send to user
                            console.log('PDF sent to user in personal chat!');
                            // Delete the file after sending (optional)
                            await fs.promises.unlink(fileName);

                            // Waiting for link elements to load
                            await page.waitForSelector('a');

                            const dataSheetLinkJunior = await page.evaluate(
                                () => {
                                    const linksJunior = Array.from(
                                        document.querySelectorAll('a')
                                    );

                                    // Logging the text of all links for analysis
                                    linksJunior.forEach((link) =>
                                        console.log(link.textContent)
                                    );

                                    return linksJunior
                                        .filter(
                                            (link) =>
                                                link.textContent
                                                    .toLowerCase()
                                                    .includes('data sheet') ||
                                                link.textContent
                                                    .toLowerCase()
                                                    .includes('data_sheet')
                                        )
                                        .map((link) => link.href); // We get the href array of all matching links
                                }
                            );

                            if (dataSheetLinkJunior.length > 0) {
                                console.log(dataSheetLinkJunior);
                            } else {
                                console.log('No links to data sheet');
                            }

                            // Follow every link found
                            for (const linkJunior of dataSheetLinkJunior) {
                                console.log('Follow the link:', linkJunior);

                                try {
                                    await page.goto(linkJunior, {
                                        waitUntil: 'networkidle2',
                                        timeout: 180000,
                                    });
                                    await page.evaluate(() => {
                                        const bannerIds = [
                                            'cocoa-proactice-chat',
                                            'onetrust-banner-sdk',
                                        ];
                                        bannerIds.forEach((id) => {
                                            const banner =
                                                document.getElementById(id);
                                            if (banner) {
                                                banner.style.display = 'none';
                                            }
                                        });
                                    });

                                    // Extracting the page title from the URL (last segment)
                                    const urlSegmentsJunior =
                                        linkJunior.split('/');
                                    const penultimateSegmentJunior =
                                        urlSegmentsJunior[
                                            urlSegmentsJunior.length - 2
                                        ];
                                    const lastSegmentJunior =
                                        urlSegmentsJunior[
                                            urlSegmentsJunior.length - 1
                                        ].split('?')[0];
                                    const fileNameJunior =
                                        `${penultimateSegmentJunior}-${lastSegmentJunior}.pdf`.replace(
                                            /[<>:"/\\|?*]/g,
                                            '-'
                                        );
                                    // Checking if parsing is still active
                                    if (!isParsing) {
                                        await browser.close();
                                        return;
                                    }
                                    // Save the page in PDF format
                                    await page.pdf({
                                        path: fileNameJunior,
                                        format: 'A4',
                                    });

                                    await bot.sendDocument(
                                        userChatId,
                                        fs.createReadStream(fileNameJunior)
                                    ); // Send to user
                                    console.log(
                                        'PDF sent to user in personal chat!'
                                    );
                                    // Delete the file after sending (optional)
                                    await fs.promises.unlink(fileNameJunior);
                                } catch (error) {
                                    console.error('Error loading page:', error);
                                }
                            }
                        } catch (error) {
                            console.error('Error loading page:', error);
                        }
                    }
                } else {
                    console.log(`Data sheet link not found`);
                    await page.goBack();
                }
            } catch (error) {
                console.error(`Error loading page. Reason: ${error.message}`);
                // Here you can perform additional actions if an error occurs, for example, write to the log
            }
        }

        await browser.close();
    } catch (error) {
        console.error('Error:', error);
        await bot.sendMessage(
            userChatId,
            'An error occurred while generating the document. Please try again.'
        );
    }
}
