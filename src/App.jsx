import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layout and components
import AppLayout from './layout/AppLayout.tsx';
import ConnectionForm from './components/forms/ConnectionForm';
import Roster from './components/conference/Roster';
import ConferenceActions from './components/conference/ConferenceActions';
import Chat from './components/conference/Chat';
import Presentation from './components/conference/Presentation';
import LayoutControl from './components/conference/LayoutControl';
import DialOutForm from './components/conference/DialOutForm';
import PinningConfigForm from './components/conference/PinningConfigForm';
import TransformLayoutForm from './components/conference/TransformLayoutForm';
import Participant from './components/conference/Participant';
import ToastContainer from './components/ui/ToastContainer.jsx';
import AllParticipants from './components/conference/AllParticipants';
import RedialDialog from './components/conference/RedialDialog';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [token, setToken] = useState(null);
  const [tokenExpires, setTokenExpires] = useState(120);
  const [conferenceAlias, setConferenceAlias] = useState('');
  const [conferenceDisplayName, setConferenceDisplayName] = useState('');
  const [participants, setParticipants] = useState([]);
  const [conferenceState, setConferenceState] = useState({ isLocked: false, guestsMuted: false, guestsCanUnmute: false });
  const [messages, setMessages] = useState([]);
  const [isReceivingPresentation, setIsReceivingPresentation] = useState(false);
  const [presentationImageUrl, setPresentationImageUrl] = useState('');
  const [availableLayouts, setAvailableLayouts] = useState({});
  const [userRole, setUserRole] = useState(null);
  const [pin, setPin] = useState('');
  const [availablePinningConfigs, setAvailablePinningConfigs] = useState([]);
  const [activePinningConfig, setActivePinningConfig] = useState('');
  const [activeLayout, setActiveLayout] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [allTimeParticipants, setAllTimeParticipants] = useState({});
  const [toastShownFor, setToastShownFor] = useState(new Set());
  const [redialParticipant, setRedialParticipant] = useState(null);
  const nextToastId = useRef(0);
  

  const appStateRef = useRef();
  appStateRef.current = { token, conferenceAlias, pin };
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const { token: currentToken, conferenceAlias: currentConference, pin: currentPin } = appStateRef.current;
      if (!currentToken || !currentConference) return;
      const apiUrl = `/api/client/v2/conferences/${currentConference}/release_token`;
      const headers = { 'Content-Type': 'application/json', token: currentToken, pin: currentPin };
      fetch(apiUrl, { method: 'POST', headers, keepalive: true });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!isConnected || !token || !conferenceAlias || eventSourceRef.current) return;
    const eventsUrl = `/api/client/v2/conferences/${conferenceAlias}/events?token=${token}`;
    const eventSource = new EventSource(eventsUrl);
    eventSourceRef.current = eventSource;
    
    eventSource.addEventListener('conference_update', (event) => {
      const update = JSON.parse(event.data);
      setConferenceState(prevState => ({ ...prevState, isLocked: update.locked, guestsMuted: update.guests_muted, guestsCanUnmute: update.guests_can_unmute }));
      if (update.pinning_config !== undefined) setActivePinningConfig(update.pinning_config);
    });
    eventSource.addEventListener('layout', (event) => {
      const layoutUpdate = JSON.parse(event.data);
      if (layoutUpdate && layoutUpdate.view) setActiveLayout(layoutUpdate.view);
    });
    eventSource.addEventListener('message_received', (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    });
    eventSource.addEventListener('participant_create', (event) => {
    const newParticipant = JSON.parse(event.data);
    const participantKey = newParticipant.display_name;
      
    const existingParticipant = allTimeParticipants[participantKey];
    const isRejoin = existingParticipant && existingParticipant.disconnectTime && !existingParticipant.isActive;
    const isActuallyNew = !existingParticipant || !existingParticipant.isActive;
      
    if (isActuallyNew) {
      if (isRejoin) {
        showToast(`${newParticipant.display_name} joined again`, 'rejoin');
      } else {
        showToast(`${newParticipant.display_name} joined the meeting`, 'join');
      }
    }
    
    setAllTimeParticipants(prev => ({
      ...prev,
      [participantKey]: {
        ...newParticipant,
        joinTime: prev[participantKey]?.joinTime || new Date().toISOString(),
        disconnectTime: null,
        isActive: true,
        protocol: newParticipant.protocol || 'sip',
        uri: newParticipant.uri || newParticipant.local_alias || null,
        uuid: newParticipant.uuid,
        rejoinCount: (prev[participantKey]?.rejoinCount || 0) + (isRejoin ? 1 : 0)
      }
    }));
    
    setParticipants(prev => {
      if (prev.some(p => p.uuid === newParticipant.uuid)) return prev;
      return [...prev, newParticipant].sort((a, b) => a.display_name.localeCompare(b.display_name));
    });
    });
    eventSource.addEventListener('participant_update', (event) => {
      const updatedParticipant = JSON.parse(event.data);
      const participantKey = updatedParticipant.display_name;

      setAllTimeParticipants(prev => ({
        ...prev,
        [participantKey]: {
          ...prev[participantKey],
          ...updatedParticipant,
          uuid: updatedParticipant.uuid
        }
      }));

      setParticipants(prev => prev.map(p => p.uuid === updatedParticipant.uuid ? updatedParticipant : p));
    });
   eventSource.addEventListener('participant_delete', (event) => {
      const deletedParticipant = JSON.parse(event.data);
      const participantKey = deletedParticipant.display_name;

      if (participantKey && participantKey !== 'undefined') {
        showToast(`${participantKey} left the meeting`, 'leave');
      }

      setAllTimeParticipants(prev => {
        if (!prev[participantKey]) return prev;
        return {
          ...prev,
          [participantKey]: {
            ...prev[participantKey],
            disconnectTime: new Date().toISOString(),
            isActive: false,
            disconnectReason: deletedParticipant.disconnect_reason || 'Left meeting'
          }
        };
      });

      setParticipants(prev => prev.filter(p => p.uuid !== deletedParticipant.uuid));
    });
    eventSource.addEventListener('presentation_start', () => setIsReceivingPresentation(true));
    eventSource.addEventListener('presentation_stop', () => {
      setIsReceivingPresentation(false);
      setPresentationImageUrl('');
    });
    eventSource.addEventListener('presentation_frame', async (event) => {
      const imageUrlPath = `/api/client/v2/conferences/${conferenceAlias}/presentation.jpeg?id=${event.lastEventId}`;
      try {
        const response = await fetch(imageUrlPath, { method: 'GET', headers: { 'token': token } });
        if (response.ok) {
          const imageBlob = await response.blob();
          const newImageUrl = URL.createObjectURL(imageBlob);
          setPresentationImageUrl(oldUrl => {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            return newImageUrl;
          });
        }
      } catch (error) { console.error("Failed to fetch presentation frame:", error); }
    });
    eventSource.addEventListener('disconnect', (event) => {
      const data = JSON.parse(event.data);
      showToast(`You were disconnected: ${data.reason}`, 'error', 8000);
      handleLeave();
    });
    eventSource.onerror = () => handleLeave();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isConnected, token, conferenceAlias]);

  useEffect(() => {
    if (!isConnected || !token) return;
    const refreshInterval = (tokenExpires * 1000) * 0.8;
    const timerId = setTimeout(() => refreshToken(), refreshInterval);
    return () => clearTimeout(timerId);
  }, [isConnected, token, tokenExpires]);

  useEffect(() => {
    if (messages.length === 1 && !isChatOpen) {
      setIsChatOpen(true);
    }
  }, [messages, isChatOpen]);

  const pexipApiGet = async (path, currentToken) => {
    try {
      const response = await fetch(path, { method: 'GET', headers: { 'token': currentToken } });
      if (response.status === 404) return { notFound: true };
      if (response.ok) return await response.json();
    } catch (error) { console.error(`API GET call to ${path} failed:`, error); }
    return null;
  };
  const pexipApiPost = async (path) => {
    try {
      await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'token': token } });
    } catch (error) { console.error(`API call to ${path} failed:`, error); }
  };
  const pexipApiPostWithBody = async (path, body) => {
    try {
      await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'token': token }, body: JSON.stringify(body) });
    } catch (error) { console.error(`API call to ${path} failed:`, error); }
  };
  
  const refreshToken = async () => {
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/refresh_token`;
    try {
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': token }
      });
      if (response.ok) {
        const result = await response.json();
        setToken(result.result.token);
        setTokenExpires(result.result.expires);
      } else {
        handleLeave();
      }
    } catch (error) {
      handleLeave();
    }
  };
  
  const handleLogin = async (formData) => {
    const { conference, pin, displayName } = formData;
    const apiUrl = `/api/client/v2/conferences/${conference}/request_token`;
    const requestBody = { display_name: displayName, start_conference_if_host: true, direct_media: true, supports_direct_chat: true };
    try {
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'pin': pin || "" }, body: JSON.stringify(requestBody) });
      const result = await response.json();
      if (response.ok) {
        const newToken = result.result.token;
        const layouts = await pexipApiGet(`/api/client/v2/conferences/${conference}/layout_svgs`, newToken);
        if (layouts) setAvailableLayouts(layouts.result);
        const pinningConfigs = await pexipApiGet(`/api/client/v2/conferences/${conference}/available_pinning_configs`, newToken);
        if (pinningConfigs && pinningConfigs.result) setAvailablePinningConfigs(pinningConfigs.result);
        setToken(newToken);
        setPin(pin);
        setUserRole(result.result.role);
        setConferenceAlias(conference);
        setConferenceDisplayName(result.result.conference_name);
        setTokenExpires(result.result.expires || 120);
        setIsConnected(true);
      } else {
        alert(`Failed to join: ${result.result || JSON.stringify(result)}`);
      }
    } catch (error) {
      alert('A network error occurred. Please check your Nginx proxy configuration.');
    }
  };

  const handleLeave = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (token && conferenceAlias) {
      const apiPath = `/api/client/v2/conferences/${conferenceAlias}/release_token`;
      pexipApiPost(apiPath);
    }
    setIsConnected(false);
    setToken(null);
    setConferenceAlias('');
    setConferenceDisplayName('');
    setParticipants([]);
    setAllTimeParticipants({}); // Clear persistent list
    setConferenceState({ isLocked: false, guestsMuted: false, guestsCanUnmute: false });
    setMessages([]);
    if (presentationImageUrl) URL.revokeObjectURL(presentationImageUrl);
    setPresentationImageUrl('');
    setAvailableLayouts({});
    setUserRole(null);
    setPin('');
    setAvailablePinningConfigs([]);
    setActivePinningConfig('');
    setActiveLayout('');
  };

  const handleToggleChat = () => {
    setIsChatOpen(prev => !prev);
  };

  const handleDialOut = (dialData) => {
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/dial`;
    const headers = { 'Content-Type': 'application/json', 'token': token };
    if (pin) headers.pin = pin;
    try {
      fetch(apiPath, { method: 'POST', headers: headers, body: JSON.stringify(dialData) });
    } catch (error) { console.error(`API call to ${apiPath} failed:`, error); }
  };
  
  const handleSetPinningConfig = (configName) => {
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/set_pinning_config`;
    const body = { pinning_config: configName };
    const headers = { 'Content-Type': 'application/json', 'token': token };
    if (pin) headers.pin = pin;
    try {
      fetch(apiPath, { method: 'POST', headers: headers, body: JSON.stringify(body) });
    } catch (error) { console.error(`API call to ${apiPath} failed:`, error); }
  };

  const handleClearPinningConfig = () => {
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/set_pinning_config`;
    const body = { pinning_config: "" };
    const headers = { 'Content-Type': 'application/json', 'token': token };
    if (pin) headers.pin = pin;
    try {
      fetch(apiPath, { method: 'POST', headers: headers, body: JSON.stringify(body) });
    } catch (error) { console.error(`API call to ${apiPath} failed:`, error); }
  };

  const showToast = (message, type = 'info', duration = 5000) => {
    const id = nextToastId.current++;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleRedial = async (participant) => {
    if (!participant.uri) {
    showToast(`Cannot redial ${participant.display_name} - no URI available`, 'error');
    return;
    }
  
    // Show initiating toast
    showToast(`Redialing ${participant.display_name}...`, 'info');
  
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/dial`;
    const headers = {
    'Content-Type': 'application/json',
    'token': token,
    'pin': pin
    };
  
    const body = {
    destination: participant.uri,
    protocol: participant.protocol || 'sip',
    role: participant.role || 'guest',
    remote_display_name: participant.display_name
    };
  
    try {
      const response = await fetch(apiPath, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (response.ok && result.result) {
        showToast(`Successfully redialing ${participant.display_name}`, 'join', 6000);

        // The participant will appear in the list with status "connecting"
        // and will update to active if they answer
      } else {
        showToast(`Failed to redial ${participant.display_name}`, 'error');
        console.error('Redial failed:', result);
      }
    } catch (error) {
      showToast(`Error redialing ${participant.display_name}`, 'error');
      console.error('Redial error:', error);
    }
  };

  const handleRedialConfirm = async (participant) => {
    setRedialParticipant(null); // Close dialog
    
    if (!participant.uri) {
      showToast(`Cannot redial ${participant.display_name} - no URI available`, 'error');
      return;
    }
    
    showToast(`Redialing ${participant.display_name}...`, 'info');
    
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/dial`;
    const headers = {
      'Content-Type': 'application/json',
      'token': token,
      'pin': pin
    };
    
    const body = {
      destination: participant.uri,
      protocol: participant.protocol || 'sip',
      role: participant.role || 'guest',
      remote_display_name: participant.display_name
    };
    
    try {
      const response = await fetch(apiPath, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (response.ok && result.result) {
        showToast(`Successfully redialing ${participant.display_name}`, 'join', 6000);
      } else {
        showToast(`Failed to redial ${participant.display_name}`, 'error');
      }
    } catch (error) {
      showToast(`Error redialing ${participant.display_name}`, 'error');
    }
  };

  const handleRedialRequest = (participant) => {
  if (!participant.uri) {
    showToast(`Cannot redial ${participant.display_name} - no dial information available`, 'error');
    return;
  }
  setRedialParticipant(participant);
  };

  // Optional: Add bulk redial function
  const handleRedialAll = async () => {
    const disconnected = Object.values(allTimeParticipants)
      .filter(p => !p.isActive && p.uri);

    if (disconnected.length === 0) {
      showToast('No disconnected participants to redial', 'info');
      return;
    }

    showToast(`Redialing ${disconnected.length} participants...`, 'info');

    // Redial with a small delay between each to avoid overwhelming the system
    for (const participant of disconnected) {
      await handleRedial(participant);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  };
  
  const handleOverrideLayout = (layoutData) => { pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/override_layout`, { layouts: [layoutData] }); };
  const handleResetLayout = () => { pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/override_layout`, { layouts: [] }); };
  
  // RESTORED HANDLERS
  const handleTransformLayout = (transformsData) => {
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/transform_layout`;
    pexipApiPostWithBody(apiPath, { transforms: transformsData });
  };
  const handleResetTransformLayout = () => {
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/transform_layout`;
    pexipApiPostWithBody(apiPath, { transforms: {} });
  };

  const handleLockToggle = () => { pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/${conferenceState.isLocked ? 'unlock' : 'lock'}`); };
  const handleMuteAllToggle = () => { pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/${conferenceState.guestsMuted ? 'unmuteguests' : 'muteguests'}`); };
  const handleToggleGuestsCanUnmute = () => { pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/set_guests_can_unmute`, { setting: !conferenceState.guestsCanUnmute }); };
  const handleSendMessage = (messageText) => {
    const localMessage = { origin: 'Me', payload: messageText };
    setMessages(prev => [...prev, localMessage]);
    pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/message`, { type: 'text/plain', payload: messageText });
  };
  const handleMuteToggle = (participantId) => {
    const p = participants.find(p => p.uuid === participantId);
    if (p) pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/participants/${participantId}/${p.is_muted === 'YES' ? 'unmute' : 'mute'}`);
  };
  const handleDisconnect = (participantId) => { pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/participants/${participantId}/disconnect`); };
  const handleCreatePersonalMix = (participantId) => { pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/video_mixes/create`, { mix_name: `main.!${participantId}` }); };
  const handleConfigurePersonalMix = (participantId, layout) => { pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/video_mixes/main.!${participantId}/configure`, { transform_layout: { layout: layout } }); };
  const handleDeletePersonalMix = (participantId) => { pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/video_mixes/main.!${participantId}/delete`); };
  const handleSpotlightToggle = (participantId) => {
    const p = participants.find(p => p.uuid === participantId);
    if (p) pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/participants/${participantId}/${p.spotlight !== 0 ? 'spotlightoff' : 'spotlighton'}`);
  };
  const handleToggleVideoMute = (participantId) => {
    const p = participants.find(p => p.uuid === participantId);
    if (p) pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/participants/${participantId}/${p.is_video_muted ? 'video_unmuted' : 'video_muted'}`);
  };
  const handleToggleSeePresentation = (participantId) => {
    const p = participants.find(p => p.uuid === participantId);
    if (p) pexipApiPost(`/api/client/v2/conferences/${conferenceAlias}/participants/${participantId}/${p.rx_presentation_policy === 'ALLOW' ? 'denyrxpresentation' : 'allowrxpresentation'}`);
  };
  const handleSetRole = (participantId, role) => { pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/participants/${participantId}/role`, { role: role }); };
  const handleSetBroadcastMessage = () => {
    const message = prompt('Enter the message to display to all participants:');
    if (message !== null) {
      pexipApiPostWithBody(`/api/client/v2/conferences/${conferenceAlias}/set_message_text`, { text: message });
    }
  };
  const handleGetBroadcastMessage = async () => {
    const response = await pexipApiGet(`/api/client/v2/conferences/${conferenceAlias}/get_message_text`, token);
    if (response && response.result) {
      alert(`Current broadcast message:\n\n${response.result.text || "No message is set."}`);
    } else {
      alert("Could not retrieve the current broadcast message.");
    }
  };
  const handleClearBroadcastMessage = () => {
    const apiPath = `/api/client/v2/conferences/${conferenceAlias}/set_message_text`;
    
    // Change the body to be an empty object
    const body = {}; 
    
    pexipApiPostWithBody(apiPath, body);
  };
  const DashboardContent = () => (
    <div className="grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5">
      {/* --- MAIN CONTENT COLUMN --- */}
      <main className={`col-span-12 ${isChatOpen ? 'lg:col-span-8' : ''} flex flex-col gap-4`}>
        {/* Presentation Card */}
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <Presentation isReceivingPresentation={isReceivingPresentation} imageUrl={presentationImageUrl} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Roster is now here, taking the full width of the main column */}
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <Roster
            participants={participants}
            availableLayouts={availableLayouts}
            userRole={userRole}
            onMuteToggle={handleMuteToggle}
            onDisconnect={handleDisconnect}
            onCreatePersonalMix={handleCreatePersonalMix}
            onConfigurePersonalMix={handleConfigurePersonalMix}
            onDeletePersonalMix={handleDeletePersonalMix}
            onSpotlightToggle={handleSpotlightToggle}
            onToggleVideoMute={handleToggleVideoMute}
            onToggleSeePresentation={handleToggleSeePresentation}
            onSetRole={handleSetRole}
          />
          </div>

          {/* All Participants Panel */}
          <AllParticipants 
            allTimeParticipants={allTimeParticipants}
            onRedial={handleRedialRequest}
            userRole={userRole}
          />
        </div>

        {/* The smaller control panels are now in a grid below the roster */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="font-semibold text-black dark:text-white mb-4">Conference Actions</h3>
            <ConferenceActions
              isLocked={conferenceState.isLocked}
              onLockToggle={handleLockToggle}
              guestsMuted={conferenceState.guestsMuted}
              onMuteAllToggle={handleMuteAllToggle}
              onSetBroadcastMessage={handleSetBroadcastMessage}
              onGetBroadcastMessage={handleGetBroadcastMessage}
              onClearBroadcastMessage={handleClearBroadcastMessage}
              guestsCanUnmute={conferenceState.guestsCanUnmute}
              onToggleGuestsCanUnmute={handleToggleGuestsCanUnmute}
            />
          </div>
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="font-semibold text-black dark:text-white mb-4">Layout Control</h3>
            <LayoutControl
              availableLayouts={availableLayouts}
              activeLayout={activeLayout}
              onOverrideLayout={handleOverrideLayout}
              onResetLayout={handleResetLayout}
            />
          </div>
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="font-semibold text-black dark:text-white mb-4">Layout Transformation</h3>
            <TransformLayoutForm
                availableLayouts={availableLayouts}
                onTransformLayout={handleTransformLayout}
                onResetLayout={handleResetTransformLayout}
            />
          </div>
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="font-semibold text-black dark:text-white mb-4">Pinning Configurations</h3>
            <PinningConfigForm
              availableConfigs={availablePinningConfigs}
              activeConfig={activePinningConfig}
              onSetPinningConfig={handleSetPinningConfig}
              onClearPinningConfig={handleClearPinningConfig}
            />
          </div>
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="font-semibold text-black dark:text-white mb-4">Dial Out</h3>
            <DialOutForm onDialOut={handleDialOut} />
          </div>
        </div>
      </main>

      {/* --- SIDEBAR COLUMN (CHAT) --- */}
      {isChatOpen && (
        <aside className="col-span-12 lg:col-span-4 h-full">
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark h-full flex flex-col">
            <Chat messages={messages} onSendMessage={handleSendMessage} />
          </div>
        </aside>
      )}
    </div>
  );

  return (
    <>
    <Routes>
      {isConnected ? (
        <Route element={<AppLayout onLeave={handleLeave} onToggleChat={handleToggleChat} conferenceDisplayName={conferenceDisplayName} />}>
          <Route path="/" element={<DashboardContent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <>
          <Route path="/login" element={<ConnectionForm onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
     {/* Add ToastContainer here */}
    <ToastContainer toasts={toasts} removeToast={removeToast} />
     <RedialDialog 
      participant={redialParticipant}
      onConfirm={handleRedialConfirm}
      onCancel={() => setRedialParticipant(null)}
    />
    </>
  );
}

export default App;