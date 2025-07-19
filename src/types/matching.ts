export interface User {
    id: string;
    name: string;
    age?: number;
    interests: string[];
    createdAt: Date;
}

export interface MatchingUser {
    userId: string;
    timestamp: number;
    preferences?: {
        ageRange?: [number, number];
        interests?: string[];
    };
}

export interface Match {
    id: string;
    users: [string, string]; //2人のユーザーID
    createdAt: Date;
    status: 'active' | 'ended';
}