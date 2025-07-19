export interface User {
    id: string;
    name: string;
    age?: number;
    interests: string[];
    createdAt: Date;
}

export interface MatchingUser {
    userId: string;
    socketId: string;
    timestamp: number;
    preferences?: {
        ageRange?: [number, number];
        interests?: string[];
        gender?: 'male' | 'female' | 'any';
        maxWaittime?: number; 
    };
    userInfo?: {
        name: string;
        age?: number;
        interests?: string[];
    };
}

export interface Match {
    id: string;
    users: [string, string]; //2人のユーザーID
    socketIds: [string, string]; //2人のSocket ID
    createdAt: Date;
    status: 'active' | 'ended' | 'disconnected';
    roomId?: string;
}

export interface  MatchingResult {
    matchid: string;
    partner: {
        userId: string;
        name: string;
        age?: number;
        interests?: string[];
    };
    roomId: string;
}

export interface MatchingStats {
    waitingCount: number;
    activeMatches: number;
    averageWaitTime: number;
}