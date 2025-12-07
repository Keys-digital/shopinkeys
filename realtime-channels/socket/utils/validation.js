// utils/validation.js
const validateMessagePayload = (payload) => {
  const errors = [];
  
  if (!payload) {
    errors.push('Payload is required');
    return { isValid: false, errors };
  }
  
  if (!payload.content || payload.content.trim().length === 0) {
    errors.push('Message content cannot be empty');
  }
  
  if (payload.content && payload.content.length > 10000) {
    errors.push('Message content too long (max 10000 characters)');
  }
  
  if (!payload.channelId && !payload.receiverId && !payload.groupId) {
    errors.push('Either channelId, receiverId, or groupId is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateGroupAction = (payload) => {
  const errors = [];
  
  if (!payload.groupId) {
    errors.push('groupId is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateMessagePayload,
  validateGroupAction
};