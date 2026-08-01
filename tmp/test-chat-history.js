async function testChatHistory() {
    const baseUrl = 'http://localhost:3000/api/chat';
    
    console.log('--- STEP 1: Sending initial message ---');
    const history = [];
    const message1 = "My name is John and I am studying for the JEE entrance exam.";
    
    try {
        const res1 = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message1, history: history })
        });
        const data1 = await res1.json();
        console.log('AI Response 1:', data1.reply);

        // Add to history
        history.push({ role: 'user', content: message1 });
        history.push({ role: 'assistant', content: data1.reply });

        console.log('\n--- STEP 2: Sending follow-up message (context check) ---');
        const message2 = "What is my name and what exam am I preparing for?";
        const res2 = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message2, history: history })
        });
        const data2 = await res2.json();
        console.log('AI Response 2:', data2.reply);

        if (data2.reply.includes('John') && (data2.reply.includes('JEE'))) {
            console.log('\nSUCCESS: AI remembered the context!');
        } else {
            console.log('\nFAILURE: AI forgot the context or responded generically.');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

testChatHistory();
