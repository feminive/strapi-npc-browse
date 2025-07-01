/**
 * Strapi NPC Browser Module for Foundry VTT
 * Fetches NPCs from Strapi API and displays them in a browsable dialog
 */

class StrapiNpcBrowser {
  static MODULE_ID = 'strapi-npc-browser';
  static API_BASE_URL = 'https://api.rolandodados.com.br';
  
  /**
   * Initialize the module
   */
  static init() {
    console.log(`${this.MODULE_ID} | Initializing Strapi NPC Browser`);
    
    // Register Handlebars helpers
    this.registerHandlebarsHelpers();
    
    // Register module settings
    this.registerSettings();
    
    // Add hooks
    Hooks.on('ready', this.onReady.bind(this));
    Hooks.on('renderActorDirectory', this.addNpcBrowserButton.bind(this));
    Hooks.on('renderActorDirectory', this.addSidebarButton.bind(this));
  }
  
  /**
   * Register custom Handlebars helpers
   */
  static registerHandlebarsHelpers() {
    // Register truncate helper
    Handlebars.registerHelper('truncate', function(str, length) {
      if (!str || typeof str !== 'string') return '';
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
    });
    
    // Register helper to check if value exists and is not empty
    Handlebars.registerHelper('hasValue', function(value) {
      return value && value.trim && value.trim() !== '';
    });
  }
  
  /**
   * Register module settings
   */
  static registerSettings() {
    game.settings.register(this.MODULE_ID, 'apiUrl', {
      name: 'API URL',
      hint: 'Base URL for the Strapi API',
      scope: 'world',
      config: true,
      type: String,
      default: this.API_BASE_URL
    });
  }
  
  /**
   * Called when Foundry is ready
   */
  static onReady() {
    console.log(`${this.MODULE_ID} | Ready`);
    
    // Create macro if it doesn't exist
    this.createMacro();
    
    // Add custom CSS
    this.addCustomCSS();
  }
  
  /**
   * Add custom CSS for the sidebar button
   */
  static addCustomCSS() {
    const css = `
     .strapi-npc-sidebar-button {
    position: absolute;
    width: 91%;
    bottom: 10px;
    right: 4px;
    left: 4px;
    z-index: 100;
    display: flex;
    align-items: center;
    padding: 10px;
    margin: 10px;
}
      
      .strapi-npc-sidebar-button:hover {
      }
      
      .strapi-npc-sidebar-button:active {
      }
      
      .strapi-npc-sidebar-button i {

      }
      
      /* Ensure the actors directory has relative positioning */
      .app.actors-sidebar {
        position: relative;
      }
      
      /* Alternative positioning if the above doesn't work */
      #actors .directory-sidebar {
        position: relative;
      }
    `;
    
    // Add CSS to head
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  /**
   * Add NPC Browser button to Actor Directory (header)
   */
  static addNpcBrowserButton(app, html) {
    if (!game.user.isGM) return;
    
    // Ensure html is a jQuery object
    const $html = html instanceof jQuery ? html : $(html);
    
    const button = $(`
      <button class="strapi-npc-browser-btn" title="${game.i18n.localize('STRAPI_NPC.BrowseNpcs') || 'Browse NPCs'}">
        <i class="fas fa-users"></i> ${game.i18n.localize('STRAPI_NPC.BrowseNpcs') || 'Browse NPCs'}
      </button>
    `);
    
    button.on('click', () => this.showNpcBrowser());
    
    $html.find('.directory-header .action-buttons').append(button);
  }
  
  /**
   * Add NPC Browser button to sidebar (bottom right)
   */
  static addSidebarButton(app, html) {
    if (!game.user.isGM) return;
    
    // Ensure html is a jQuery object
    const $html = html instanceof jQuery ? html : $(html);
    
    // Create the sidebar button
    const sidebarButton = $(`
      <button class="strapi-npc-sidebar-button" title="Browse Strapi NPCs">
        <i class="fas fa-users"></i>
        <span>NPCs</span>
      </button>
    `);
    
    // Add click handler
    sidebarButton.on('click', () => this.showNpcBrowser());
    
    // Try different selectors to find the right container
    const containers = [
      $html.find('.app-window-content'),
      $html.find('.directory-sidebar'),
      $html.find('.directory'),
      $html
    ];
    
    let buttonAdded = false;
    for (let container of containers) {
      if (container.length > 0) {
        container.css('position', 'relative');
        container.append(sidebarButton);
        buttonAdded = true;
        console.log(`${this.MODULE_ID} | Sidebar button added to:`, container[0]);
        break;
      }
    }
    
    if (!buttonAdded) {
      console.warn(`${this.MODULE_ID} | Could not find suitable container for sidebar button`);
      // Fallback: try to add to the main html element
      $html.css('position', 'relative').append(sidebarButton);
    }
  }
  
  /**
   * Create a macro for easy access
   */
  static async createMacro() {
    const macroName = 'Browse Strapi NPCs';
    const existingMacro = game.macros.find(m => m.name === macroName);
    
    if (!existingMacro && game.user.isGM) {
      await Macro.create({
        name: macroName,
        type: 'script',
        img: 'icons/svg/mystery-man.svg',
        command: `game.modules.get('strapi-npc-browser').api.showNpcBrowser();`,
        folder: null,
        sort: 0,
        ownership: { default: 0, [game.user.id]: 3 }
      });
      
      const macroMessage = game.i18n.localize('STRAPI_NPC.MacroCreated') || 'Macro created';
      ui.notifications.info(`${macroMessage}: ${macroName}`);
    }
  }
  
  /**
   * Fetch NPCs from Strapi API
   */
  static async fetchNpcsFromStrapi() {
    try {
      const apiUrl = game.settings.get(this.MODULE_ID, 'apiUrl');
      const response = await fetch(`${apiUrl}/api/npcs?populate=*`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform Strapi data format
      return data.data.map(npc => ({
        id: npc.id,
        name: npc.attributes.name || 'Unnamed NPC',
        content: npc.attributes.content || '',
        campanha: npc.attributes.campanha || '',
        nucleo: npc.attributes.nucleo || '',
        img: npc.attributes.img?.data?.attributes?.url 
          ? `${apiUrl}${npc.attributes.img.data.attributes.url}`
          : 'icons/svg/mystery-man.svg'
      }));
      
    } catch (error) {
      console.error(`${this.MODULE_ID} | Error fetching NPCs:`, error);
      const errorMessage = game.i18n.localize('STRAPI_NPC.FetchError') || 'Error fetching NPCs';
      ui.notifications.error(`${errorMessage}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get unique campaigns from NPCs
   */
  static getUniqueCampaigns(npcs) {
    const campaigns = npcs
      .map(npc => npc.campanha)
      .filter(campanha => campanha && campanha.trim() !== '')
      .filter((campanha, index, arr) => arr.indexOf(campanha) === index)
      .sort();
    
    return campaigns;
  }
  
  /**
   * Show the NPC browser dialog
   */
  static async showNpcBrowser() {
    const fetchingMessage = game.i18n.localize('STRAPI_NPC.FetchingNpcs') || 'Fetching NPCs...';
    ui.notifications.info(fetchingMessage);
    
    const npcs = await this.fetchNpcsFromStrapi();
    
    if (npcs.length === 0) {
      const noNpcsMessage = game.i18n.localize('STRAPI_NPC.NoNpcsFound') || 'No NPCs found';
      ui.notifications.warn(noNpcsMessage);
      return;
    }
    
    const campaigns = this.getUniqueCampaigns(npcs);
    
    // Render the dialog template
    const content = await renderTemplate('modules/strapi-npc-browser/templates/npc-browser-dialog.html', {
      npcs: npcs,
      campaigns: campaigns
    });
    
    // Create and show dialog
    const browserTitle = game.i18n.localize('STRAPI_NPC.BrowserTitle') || 'NPC Browser';
    new Dialog({
      title: browserTitle,
      content: content,
      buttons: {},
      default: '',
      render: (html) => {
        const $html = html instanceof jQuery ? html : $(html);
        let selectedCampaign = '';
        
        // Filter function
        const filterNpcs = () => {
          const searchTerm = $html.find('#npc-search').val().toLowerCase();
          const npcItems = $html.find('.npc-item');
          
          npcItems.each(function() {
            const $item = $(this);
            const npcId = $item.data('npc-id');
            const npc = npcs.find(n => n.id == npcId);
            
            if (!npc) return;
            
            const name = npc.name.toLowerCase();
            const content = npc.content.toLowerCase();
            const nucleo = npc.nucleo.toLowerCase();
            
            // Check if matches search term
            const matchesSearch = !searchTerm || 
              name.includes(searchTerm) || 
              content.includes(searchTerm) || 
              nucleo.includes(searchTerm);
            
            // Check if matches selected campaign
            const matchesCampaign = !selectedCampaign || 
              npc.campanha === selectedCampaign;
            
            if (matchesSearch && matchesCampaign) {
              $item.show();
            } else {
              $item.hide();
            }
          });
        };
        
        // Campaign filter handlers
        $html.find('.campaign-filter').on('click', function() {
          const $this = $(this);
          const campaign = $this.data('campaign') || '';
          
          // Update selected campaign
          selectedCampaign = campaign;
          
          // Update active state
          $html.find('.campaign-filter').removeClass('active');
          $this.addClass('active');
          
          // Filter NPCs
          filterNpcs();
        });
        
        // Search handler
        $html.find('#npc-search').on('input', filterNpcs);
        
        // Add click handlers to NPC images
        $html.find('.npc-item').on('click', (event) => {
          const npcId = $(event.currentTarget).data('npc-id');
          const npc = npcs.find(n => n.id == npcId);
          if (npc) {
            this.postNpcToChat(npc);
          }
        });
      },
      close: () => {}
    }, {
      width: 900,
      resizable: true,
      classes: ['strapi-npc-browser-dialog']
    }).render(true);
  }
  
  /**
   * Post NPC to chat
   */
  static async postNpcToChat(npc) {
    const campaignInfo = npc.campanha && npc.campanha.trim() !== '' 
      ? `<div class="npc-meta"><strong>Campanha:</strong> ${npc.campanha}</div>` 
      : '';
    
    const nucleoInfo = npc.nucleo && npc.nucleo.trim() !== '' 
      ? `<div class="npc-meta"><strong>Núcleo:</strong> ${npc.nucleo}</div>` 
      : '';
    
    const chatContent = `
      <div class="strapi-npc-chat-card">
        <div class="npc-header">
          <img src="${npc.img}" alt="${npc.name}" class="npc-portrait" />
          <div class="npc-title-info">
            <h3 class="npc-name">${npc.name}</h3>
            ${campaignInfo}
            ${nucleoInfo}
          </div>
        </div>
        <div class="npc-content">
          ${npc.content ? `<p>${npc.content}</p>` : '<p><em>No description available</em></p>'}
        </div>
      </div>
    `;
    
    try {
      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker(),
        content: chatContent,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      });
      
      const successMessage = game.i18n.localize('STRAPI_NPC.NpcPosted') || 'NPC posted to chat';
      ui.notifications.info(`${successMessage}: ${npc.name}`);
      
    } catch (error) {
      console.error(`${this.MODULE_ID} | Error posting to chat:`, error);
      const errorMessage = game.i18n.localize('STRAPI_NPC.ChatError') || 'Error posting to chat';
      ui.notifications.error(`${errorMessage}: ${error.message}`);
    }
  }
}

// Initialize the module
Hooks.once('init', () => {
  StrapiNpcBrowser.init();
  
  // Expose API for macro usage
  game.modules.get('strapi-npc-browser').api = {
    showNpcBrowser: StrapiNpcBrowser.showNpcBrowser.bind(StrapiNpcBrowser),
    fetchNpcs: StrapiNpcBrowser.fetchNpcsFromStrapi.bind(StrapiNpcBrowser),
    postNpcToChat: StrapiNpcBrowser.postNpcToChat.bind(StrapiNpcBrowser)
  };
});

console.log('Strapi NPC Browser | Module loaded');
