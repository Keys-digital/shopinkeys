// Simple test to debug the issue
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.test' });

const User = require('./models/User');
const BlogPost = require('./models/BlogPost');
const { logAudit } = require('./repositories/auditLogRepository');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create a test user
        const user = await User.create({
            name: 'Test User',
            username: 'testuser',
            email: 'test@example.com',
            password: 'Password123!',
            role: 'Collaborator',
            isEmailVerified: true,
        });

        console.log('User created:', user._id);

        // Try to log audit
        const result = await logAudit({
            userId: user._id,
            action: 'AUTO_APPROVE_POST',
            targetUserId: user._id,
            details: 'Test audit log',
            ipAddress: '127.0.0.1',
            userAgent: 'test',
        });

        console.log('Audit log result:', result);

        await User.deleteOne({ _id: user._id });
        await mongoose.connection.close();
        console.log('Test completed successfully');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

test();
