import MatchingTest from '@/components/matching/MatchingTest';
import MatchingQueue from '@/components/matching/MatchingQueue';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">V-Chat マッチング機能テスト</h1>
        
        {/* タブ切り替え */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow p-1">
            <button className="px-4 py-2 rounded bg-blue-500 text-white">
              デバッグモード
            </button>
            <button className="px-4 py-2 rounded text-gray-600 hover:bg-gray-100">
              実際のUI
            </button>
          </div>
        </div>
        
        <MatchingTest />
      </div>
    </div>
  );
}