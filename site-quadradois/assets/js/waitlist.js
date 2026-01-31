// Waitlist Modal Handler
(function() {
  'use strict';
  
  // Configuration - Supabase
  const SUPABASE_URL = 'https://qtlpkxbvrhgqmrwcmcfp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bHBreGJ2cmhncW1yd2NtY2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODc2OTksImV4cCI6MjA4MDg2MzY5OX0.x4zez24C_dG94wWuSZRaHDbLk_X9eAjhkjcrbcoChcs';
  
  // Elements
  const modal = document.getElementById('waitlistModal');
  const modalClose = document.getElementById('modalClose');
  const form = document.getElementById('waitlistForm');
  const submitBtn = document.getElementById('submitBtn');
  const selectedPlanInput = document.getElementById('selectedPlan');
  const selectedPlanBadge = document.getElementById('selectedPlanBadge');
  const successMessage = document.getElementById('successMessage');
  
  // Plan buttons
  const planButtons = document.querySelectorAll('.pricing-cta .btn');
  
  // Open modal when plan button is clicked
  planButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Get plan name from closest card
      const card = this.closest('.pricing-card');
      const planName = card.querySelector('.plan-name').textContent;
      const planPrice = card.querySelector('.price-amount').textContent;
      
      // Set plan in hidden input
      selectedPlanInput.value = planName;
      
      // Show plan badge
      selectedPlanBadge.textContent = `Plano selecionado: ${planName} - ${planPrice}`;
      selectedPlanBadge.style.display = 'inline-block';
      
      // Open modal
      openModal();
    });
  });
  
  // Close modal
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // ESC key to close
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
  
  // Form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    // Get form data
    const formData = {
      nome: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      whatsapp: document.getElementById('phone').value.trim(),
      empresa: document.getElementById('company').value.trim() || 'Não informado',
      tipo: document.getElementById('tipo').value,
      creci: document.getElementById('creci').value.trim(),
      plano: selectedPlanInput.value,
      origem: 'Landing Page - Lista VIP'
    };
    
    // Submit to Supabase
    await submitToSupabase(formData);
  });
  
  // Phone mask
  const phoneInput = document.getElementById('phone');
  phoneInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 6) {
      value = `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0,2)}) ${value.slice(2)}`;
    }
    
    e.target.value = value;
  });
  
  // Functions
  function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Reset form
    form.reset();
    form.style.display = 'block';
    successMessage.classList.remove('active');
    clearErrors();
  }
  
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  function validateForm() {
    let isValid = true;
    clearErrors();
    
    // Name
    const name = document.getElementById('name').value.trim();
    if (name.length < 3) {
      showError('name', 'Por favor, informe seu nome completo');
      isValid = false;
    }
    
    // Email
    const email = document.getElementById('email').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('email', 'Por favor, informe um email válido');
      isValid = false;
    }
    
    // Phone
    const phone = document.getElementById('phone').value.replace(/\D/g, '');
    if (phone.length < 10) {
      showError('phone', 'Por favor, informe um WhatsApp válido');
      isValid = false;
    }
    
    // Tipo
    const tipo = document.getElementById('tipo').value;
    if (!tipo) {
      showError('tipo', 'Por favor, selecione uma opção');
      isValid = false;
    }
    
    // CRECI
    const creci = document.getElementById('creci').value.trim();
    if (creci.length < 3) {
      showError('creci', 'Por favor, informe seu CRECI');
      isValid = false;
    }
    
    return isValid;
  }
  
  function showError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const error = document.getElementById(fieldId + 'Error');
    
    input.classList.add('error');
    error.textContent = message;
    error.classList.add('active');
  }
  
  function clearErrors() {
    const inputs = form.querySelectorAll('.form-input');
    const errors = form.querySelectorAll('.form-error');
    
    inputs.forEach(input => input.classList.remove('error'));
    errors.forEach(error => error.classList.remove('active'));
  }
  
  async function submitToSupabase(data) {
    // Show loading
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    try {
      console.log('=== ENVIANDO PARA SUPABASE ===');
      console.log('Dados:', data);
      
      // Enviar para Supabase
      const response = await fetch(`${SUPABASE_URL}/rest/v1/leads_vip`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      console.log('✅ Lead salvo com sucesso no Supabase!');
      
      // Show success
      form.style.display = 'none';
      successMessage.classList.add('active');
      
      // Close after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
      
    } catch (error) {
      console.error('❌ ERRO ao enviar:', error);
      alert('Erro ao enviar formulário. Por favor, tente novamente.\n' + error.message);
    } finally {
      // Hide loading
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }
  
})();
