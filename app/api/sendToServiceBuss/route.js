import { TableClient } from "@azure/data-tables";
import { ServiceBusClient } from "@azure/service-bus";

export async function POST(req) {
    try {
        // Step 1: Parse the incoming request body (user data)
        const { firstName, lastName, email, password, photoUrl } = await req.json();
        console.log("Received data:", { firstName, lastName, email, password, photoUrl });

        // Step 2: Save user data to Azure Table Storage
        const tableConnectionString = process.env.AZURE_TABLES_CONNECTION_STRING;
        const tableClient = TableClient.fromConnectionString(tableConnectionString, "Users");

        const userEntity = {
            partitionKey: "user",   // Common partition key
            rowKey: email,          // Unique row key based on email
            firstName,              // First name
            lastName,               // Last name
            email,                  // Email
            password,               // Password
            photoUrl                // Photo URL
        };

        // Save (or update) the user data in the table
        await tableClient.upsertEntity(userEntity);
        console.log("User data saved to Table Storage!");

        // Step 3: Send message to Azure Service Bus Queue
        const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
        const sbClient = new ServiceBusClient(serviceBusConnectionString);
        const queueName = "process_worker";  // Your queue name

        const sender = sbClient.createSender(queueName);
        const message = {
            body: {
                email,    // User's email
                photoUrl  // URL of the uploaded photo
            },
            contentType: "application/json"
        };
        console.log("Sending message to Service Bus:", message);

        // Send the message to the queue
        await sender.sendMessages(message);
        console.log("Message sent to Service Bus!");

        // Close the Service Bus client
        await sbClient.close();

        // Step 4: Return success response
        return new Response(JSON.stringify({ message: "User data saved and message sent to Service Bus!" }), { status: 201 });

    } catch (error) {
        // Log the error and return a failure response
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: "Failed to save user data or send message to Service Bus", details: error.message }), { status: 500 });
    }
}
