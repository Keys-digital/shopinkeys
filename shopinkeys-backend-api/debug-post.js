// Debug test for createPost
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.test' });

const User = require('./models/User');
const BlogPost = require('./models/BlogPost');
const { checkPlagiarism } = require('./utils/plagiarism');
const { checkKGR } = require('./utils/seo');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create a test user
        const user = await User.create({
            name: 'Test User',
            username: 'testuser2',
            email: 'test2@example.com',
            password: 'Password123!',
            role: 'Collaborator',
            isEmailVerified: true,
        });

        console.log('User created:', user._id);

        // Try to create a blog post
        const longContent = "word ".repeat(1500);
        const post = new BlogPost({
            authorId: user._id,
            title: "Test Post",
            slug: "test-post-" + Date.now(),
            content: longContent,
            featuredImage: "https://example.com/image.jpg",
            status: "in_review",
        });

        console.log('Checking plagiarism...');
        const plagScore = await checkPlagiarism(post.content);
        console.log('Plagiarism score:', plagScore);

        console.log('Checking KGR...');
        const kgrResult = await checkKGR(post.content, "");
        console.log('KGR result:', kgrResult);

        await post.save();
        console.log('Post created:', post._id);

        await BlogPost.deleteOne({ _id: post._id });
        await User.deleteOne({ _id: user._id });
        await mongoose.connection.close();
        console.log('Test completed successfully');
    } catch (error) {
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

test();
