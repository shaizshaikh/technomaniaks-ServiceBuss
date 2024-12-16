import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import { ServiceBusClient } from "@azure/service-bus";  // Import Service Bus client
import { NextResponse } from "next/server";

export const POST = async (req) => {
    try {
        // Parse incoming form data
        const formData = await req.formData();

        const firstName = formData.get('firstName');
        const lastName = formData.get('lastName');
        const email = formData.get('email');
        const password = formData.get('password');
        const photo = formData.get('photo');

        // Ensure that a photo was uploaded
        if (!photo) {
            return new NextResponse("No photo uploaded", { status: 400 });
        }

        console.log("Photo Object:", photo);

        // Blob Storage connection
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Generate blob name and upload photo to Blob Storage
        const blobName = `${email}-${photo.name}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Convert the photo to a Buffer
        const arrayBuffer = await photo.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload the photo buffer to Blob Storage
        await blockBlobClient.uploadData(buffer);
        const photoUrl = blockBlobClient.url;

        // Table Storage connection
        const tableConnectionString = process.env.AZURE_TABLES_CONNECTION_STRING;
        const client = TableClient.fromConnectionString(tableConnectionString, "Users");

        // User entity to store in Table Storage
        const userEntity = {
            partitionKey: "user",  // Common partition key
            rowKey: email,         // Unique row key (email)
            firstName,
            lastName,
            email,
            password,
            photoUrl,  // The URL of the uploaded photo
        };

        // Insert or update the user data in Table Storage
        await client.upsertEntity(userEntity);

        // --- Send a message to the Service Bus after saving data ---
        const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
        const sbClient = new ServiceBusClient(serviceBusConnectionString);

        // Create a sender for the processing_worker queue
        const sender = sbClient.createSender("process_worker");

        // Message body: send the user's email and photo URL
        const message = {
            body: {
                email,
                photoUrl,
            },
            contentType: "application/json",
            sessionId: email,  // Set the SessionId to the user's email or another unique identifier
        };

        // Send the message to the Service Bus queue
        await sender.sendMessages(message);

        // Close the Service Bus client after sending the message
        await sbClient.close();

        // Return success response
        return new NextResponse(JSON.stringify({ message: "User data saved successfully, and message sent to Service Bus" }), { status: 201 });
    } catch (error) {
        console.error("Error:", error);
        return new NextResponse("Error saving user data", { status: 500 });
    }
};
