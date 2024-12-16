import { ServiceBusClient } from "@azure/service-bus";
import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import axios from "axios";
import sharp from "sharp";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

// Log the environment variables to ensure they are loaded correctly
console.log("SERVICE_BUS_CONNECTION_STRING:", process.env.AZURE_SERVICE_BUS_CONNECTION_STRING);
console.log("STORAGE_CONNECTION_STRING:", process.env.AZURE_STORAGE_CONNECTION_STRING);
console.log("TABLE_CONNECTION_STRING:", process.env.AZURE_TABLES_CONNECTION_STRING);
console.log("STORAGE_CONTAINER_NAME:", process.env.AZURE_STORAGE_CONTAINER_NAME);

const SERVICE_BUS_CONNECTION_STRING = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const TABLE_CONNECTION_STRING = process.env.AZURE_TABLES_CONNECTION_STRING;
const STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME;

// Function to process the incoming message
async function processQueueMessage(message) {
    try {
        console.log(`[INFO] Processing message: ${JSON.stringify(message.body)}`);

        const { email, photoUrl } = message.body;
        console.log(`[INFO] Email: ${email}, Photo URL: ${photoUrl}`);

        // Download the photo from the provided URL
        console.log(`[INFO] Downloading photo from URL: ${photoUrl}`);
        const photoBuffer = await axios.get(photoUrl, { responseType: "arraybuffer" }).then((response) => response.data);

        // Resize the image using Sharp
        console.log(`[INFO] Resizing the image...`);
        const processedImageBuffer = await sharp(photoBuffer)
            .resize(256, 256) // Resize the image to 256x256
            .toBuffer();

        // Blob Storage setup
        console.log(`[INFO] Uploading processed image to Blob Storage...`);
        const blobServiceClient = BlobServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient(STORAGE_CONTAINER_NAME);
        const blobName = `${email}-profile-photo.jpg`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Delete the old blob if it exists
        console.log(`[INFO] Checking for existing blob: ${blobName}`);
        await blockBlobClient.deleteIfExists();
        console.log(`[INFO] Old blob deleted: ${blobName}`);

        // Upload the processed image to Blob Storage
        await blockBlobClient.uploadData(processedImageBuffer);
        const newPhotoUrl = blockBlobClient.url;
        console.log(`[INFO] Processed image uploaded successfully. New photo URL: ${newPhotoUrl}`);

        // Update the user entity in Table Storage with the new photo URL
        console.log(`[INFO] Updating Table Storage for email: ${email}`);
        const tableClient = TableClient.fromConnectionString(TABLE_CONNECTION_STRING, "Users");
        const userEntity = {
            partitionKey: "user",
            rowKey: email,
            photoUrl: newPhotoUrl,
        };

        // Upsert the entity to replace the old URL with the new one
        await tableClient.upsertEntity(userEntity);
        console.log(`[INFO] Table Storage updated successfully for email: ${email}`);
    } catch (error) {
        console.error(`[ERROR] Error processing message: ${error.message}`);
        if (error.response) {
            console.error(`[ERROR] Axios response: ${JSON.stringify(error.response.data)}`);
        }
        console.error(error.stack);
        throw error; // Re-throw to ensure message visibility in Service Bus
    }
}

// Function to start the worker and listen to messages
async function startWorker() {
    console.log("[INFO] Starting worker...");

    let serviceBusClient;

    try {
        serviceBusClient = new ServiceBusClient(SERVICE_BUS_CONNECTION_STRING);
        const receiver = serviceBusClient.createReceiver("process_worker", {
            receiveMode: "peekLock", // Default mode
        });

        receiver.subscribe({
            processMessage: async (message) => {
                console.log("[INFO] Message received from Service Bus.");
                try {
                    await processQueueMessage(message);
                    await receiver.completeMessage(message); // Mark message as completed
                    console.log(`[INFO] Message processed successfully.`);
                } catch (error) {
                    console.error(`[ERROR] Failed to process message: ${error.message}`);
                    await receiver.abandonMessage(message); // Abandon message for retry
                }
            },
            processError: async (error) => {
                console.error("[ERROR] Error receiving messages from Service Bus:", error);
                if (error instanceof Error) {
                    console.error(error.stack);
                }
            },
        });

        console.log("[INFO] Worker is now listening for messages...");
    } catch (err) {
        console.error(`[ERROR] Error starting the worker: ${err.message}`);
        console.error(err.stack);
    } finally {
        process.on("SIGINT", async () => {
            console.log("[INFO] Shutting down worker...");
            if (serviceBusClient) {
                await serviceBusClient.close();
            }
            process.exit(0);
        });
    }
}

// Start the worker
startWorker();
