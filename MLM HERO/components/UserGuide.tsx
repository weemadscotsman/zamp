import React from 'react';

interface UserGuideProps {
  onClose: () => void;
}

const UserGuide: React.FC<UserGuideProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800 bg-gray-950">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-neon-blue">CANN.ON.AI</span> Manual
            </h2>
            <p className="text-gray-400 text-sm mt-1">Operational Guide v3.0</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-12 text-gray-300">
          
          {/* Section 1: Core Concepts */}
          <section>
            <h3 className="text-xl font-bold text-neon-blue mb-4 border-b border-gray-800 pb-2">1. Core Workflows</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neon-blue"></span>
                    Sprite Generator
                </h4>
                <p className="text-sm leading-relaxed mb-4">
                  Designed for creating static game assets. Uses the <strong>Nano Banana</strong> model series.
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-gray-400">
                  <li><strong>Flash Model:</strong> Fast, good for prototyping and simple pixel art.</li>
                  <li><strong>Pro Model:</strong> High fidelity, supports 2K/4K resolution logic.</li>
                  <li><strong>PBR Maps:</strong> After generation, use "Build PBR Maps" to create Normal, Roughness, and ORM textures for realistic lighting in UE5/Unity.</li>
                </ul>
              </div>
              <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neon-purple"></span>
                    Cutscene Director
                </h4>
                <p className="text-sm leading-relaxed mb-4">
                  Generates full motion video files (MP4) for use as cutscenes or animated backgrounds.
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-gray-400">
                  <li><strong>Veo 3.1:</strong> Google's native video model. Requires a paid API key selection via the popup.</li>
                  <li><strong>OpenRouter:</strong> Use external models (Luma, Runway, etc.) by providing your own API key and Model ID.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Animation Studio */}
          <section>
            <h3 className="text-xl font-bold text-neon-green mb-4 border-b border-gray-800 pb-2">2. Animation Studio</h3>
            <p className="mb-4 text-sm">
                The Animation Studio allows you to take <strong>any</strong> generated static asset and turn it into a sprite sheet.
            </p>
            <div className="bg-gray-950 p-6 rounded-xl border border-gray-800">
                <ol className="list-decimal pl-5 space-y-3 text-sm">
                    <li>Generate a static character in <strong>Image Mode</strong>.</li>
                    <li>Once generated, look at the <strong>Animation Studio</strong> toolbar at the bottom of the screen.</li>
                    <li>Click <strong>Walk</strong>, <strong>Run</strong>, <strong>Idle</strong>, or <strong>Attack</strong>.</li>
                    <li>The system uses your current asset as an image-prompt to ensure the animation looks exactly like your character.</li>
                    <li>Download the resulting "Sprite Sheet" for use in a Flipbook or Animator Controller.</li>
                </ol>
            </div>
          </section>

          {/* Section 3: Bleeding Edge Config */}
          <section>
            <h3 className="text-xl font-bold text-red-400 mb-4 border-b border-gray-800 pb-2">3. Deep Options (Bleeding Edge)</h3>
            <div className="space-y-4">
                <div className="flex gap-4">
                    <div className="w-32 font-bold text-white text-sm">Temperature</div>
                    <div className="text-sm text-gray-400">Controls randomness. Higher (1.0+) is more creative/chaotic. Lower (0.1) is more deterministic/focused.</div>
                </div>
                <div className="flex gap-4">
                    <div className="w-32 font-bold text-white text-sm">Top K / Top P</div>
                    <div className="text-sm text-gray-400">Advanced sampling parameters. Restricts the token pool to the top K probable tokens or cumulative probability P. Tuning these can reduce hallucinations.</div>
                </div>
                <div className="flex gap-4">
                    <div className="w-32 font-bold text-white text-sm">Seed</div>
                    <div className="text-sm text-gray-400">Setting a specific number (e.g., 42) ensures that the same prompt yields the same result every time. Use 0 for random.</div>
                </div>
                <div className="flex gap-4">
                    <div className="w-32 font-bold text-white text-sm">System Instruction</div>
                    <div className="text-sm text-gray-400">A powerful override. "You are a pixel artist from the 90s" or "You are a 3D Modeler specializing in sci-fi". This frames the model's entire personality.</div>
                </div>
            </div>
          </section>

           {/* Section 4: Export Formats */}
           <section>
            <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">4. Engine Export Guide</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-gray-700 rounded-lg">
                    <h5 className="font-bold text-white mb-2">Unity</h5>
                    <p className="text-xs text-gray-400">Uses standard Metallic/Smoothness setup. Import the <strong>Mask Map</strong> into the Metallic slot of the Standard Shader.</p>
                </div>
                 <div className="p-4 border border-gray-700 rounded-lg">
                    <h5 className="font-bold text-white mb-2">Unreal Engine 5</h5>
                    <p className="text-xs text-gray-400">Uses ORM (Occlusion, Roughness, Metallic) packed textures. Connect RGB directly to the respective inputs in your Material Graph.</p>
                </div>
                 <div className="p-4 border border-gray-700 rounded-lg">
                    <h5 className="font-bold text-white mb-2">Godot</h5>
                    <p className="text-xs text-gray-400">Standard PBR workflow. Height map can be used for Parallax Occlusion Mapping in the StandardMaterial3D.</p>
                </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default UserGuide;