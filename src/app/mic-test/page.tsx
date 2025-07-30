'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function MicTestPage() {
  const [isTesting, setIsTesting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopTest();
    };
  }, []);

  const startTest = async () => {
    try {
      setTestResult(null);
      setErrorMessage('');
      
      // マイクへのアクセスを要求
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      // AudioContextを作成
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // 音声分析用のノードを作成
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      
      // ノードを接続
      source.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(audioContext.destination);
      
      // 音量を設定
      gainNode.gain.value = volume / 100;
      
      // 音声レベルを監視
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isTesting) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average);
          animationRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      setIsTesting(true);
      updateAudioLevel();
      
      // 5秒後に自動停止
      setTimeout(() => {
        if (isTesting) {
          stopTest();
          setTestResult('success');
        }
      }, 5000);
      
    } catch (error) {
      console.error('マイクテストエラー:', error);
      setErrorMessage('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
      setTestResult('error');
    }
  };

  const stopTest = () => {
    setIsTesting(false);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setAudioLevel(0);
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    
    if (audioContextRef.current && streamRef.current) {
      // 新しいAudioContextで音量を調整
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = newVolume / 100;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            onClick={() => window.close()}
            variant="outline" 
            size="sm" 
            className="flex items-center bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-2xl font-bold text-white">マイクテスト</h1>
          <div className="w-20"></div> {/* スペーサー */}
        </div>

        {/* メインカード */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
          {/* マイクアイコン */}
          <div className="text-center mb-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-300 ${
              isTesting 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg' 
                : 'bg-gray-700'
            }`}>
              {isTesting ? (
                <Mic className="w-12 h-12 text-white" />
              ) : (
                <MicOff className="w-12 h-12 text-gray-400" />
              )}
            </div>
            
            {/* 音声レベルメーター */}
            {isTesting && (
              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${(audioLevel / 255) * 100}%` }}
                ></div>
              </div>
            )}
            
            <p className="text-gray-300 text-sm">
              {isTesting ? 'マイクテスト中... 話してみてください' : 'マイクのテストを開始します'}
            </p>
          </div>

          {/* テスト結果 */}
          {testResult && (
            <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
              testResult === 'success' 
                ? 'bg-green-900/50 border border-green-600' 
                : 'bg-red-900/50 border border-red-600'
            }`}>
              {testResult === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={`text-sm ${
                testResult === 'success' ? 'text-green-300' : 'text-red-300'
              }`}>
                {testResult === 'success' 
                  ? 'マイクテストが完了しました！' 
                  : errorMessage
                }
              </span>
            </div>
          )}

          {/* コントロール */}
          <div className="space-y-4">
            {/* テスト開始/停止ボタン */}
            <Button
              onClick={isTesting ? stopTest : startTest}
              variant={isTesting ? "destructive" : "default"}
              size="lg"
              className={`w-full ${
                isTesting 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isTesting ? 'テスト停止' : 'テスト開始'}
            </Button>

            {/* ミュート切り替え */}
            {isTesting && (
              <Button
                onClick={toggleMute}
                variant="outline"
                size="sm"
                className="w-full bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 mr-2" />
                    ミュート解除
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 mr-2" />
                    ミュート
                  </>
                )}
              </Button>
            )}

            {/* 音量調整 */}
            {isTesting && (
              <div className="space-y-2">
                <label className="text-sm text-gray-300">音量調整</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0%</span>
                  <span>{volume}%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>

          {/* 説明 */}
          <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
            <h3 className="text-white font-semibold mb-2">テストの手順</h3>
            <ol className="text-sm text-gray-300 space-y-1">
              <li>1. 「テスト開始」ボタンをクリック</li>
              <li>2. ブラウザのマイク許可を承認</li>
              <li>3. 話して音声レベルを確認</li>
              <li>4. 5秒後に自動停止、または手動で停止</li>
            </ol>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
} 