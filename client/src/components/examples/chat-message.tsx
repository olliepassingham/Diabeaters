import { ChatMessage } from '../chat-message';

export default function ChatMessageExample() {
  return (
    <div className="space-y-4 p-4 max-w-4xl">
      <ChatMessage
        role="user"
        content="I'm planning to go for a 30-minute run. What should I adjust?"
        timestamp="2:45 PM"
      />
      <ChatMessage
        role="assistant"
        content="For a 30-minute moderate-intensity run, I recommend consuming 15-20g of fast-acting carbohydrates about 15 minutes before you start. You might also consider reducing your bolus insulin by 30-50% for your pre-run meal if you're eating within 2 hours of the activity."
        timestamp="2:46 PM"
      />
    </div>
  );
}
