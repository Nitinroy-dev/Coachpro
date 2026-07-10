// CoachPro Razorpay Integration Helper

export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export const openRazorpayCheckout = async ({ amount, studentName, studentPhone, description, onSuccess, onFailure }) => {
  const isLoaded = await loadRazorpayScript()
  if (!isLoaded) {
    onFailure('Razorpay SDK failed to load. Are you online?')
    return
  }

  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TY11234567'

  const options = {
    key: razorpayKeyId,
    amount: amount, // Amount is in currency subunits (paise)
    currency: 'INR',
    name: 'CoachPro Institute',
    description: description,
    image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', // Default icon
    handler: function (response) {
      // response.razorpay_payment_id
      // response.razorpay_order_id
      // response.razorpay_signature
      if (onSuccess) {
        onSuccess(response)
      }
    },
    prefill: {
      name: studentName,
      contact: studentPhone,
    },
    theme: {
      color: '#1E3A8A' // CoachPro primary blue
    }
  }

  const paymentObject = new window.Razorpay(options)
  paymentObject.on('payment.failed', function (response) {
    if (onFailure) {
      onFailure(response.error.description)
    }
  })
  
  paymentObject.open()
}
